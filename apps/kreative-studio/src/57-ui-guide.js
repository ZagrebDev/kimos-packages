
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
      tip: 'La propuesta de valor, una idea por frase. De ahí salen los atributos, los beneficios y casi todo el copy.',
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
      n: 4, title: 'Produce el material', view: 'jobs', cta: 'Ver los trabajos',
      body: 'Aquí está la lista de trabajos con su prompt, su proveedor y su coste estimado. Genera primero TODOS los keyframes y valida el producto antes de gastar en vídeo: un vídeo malo cuesta entre 10 y 30 veces más que la imagen que lo habría evitado.',
      tip: 'Registra cada resultado con el asset correspondiente: se versiona, cierra el trabajo y el coste real sustituye al estimado.',
    },
    {
      n: 5, title: 'Monta y exporta', view: 'editor', cta: 'Abrir el Editor',
      body: 'Descarga el script de montaje, los subtítulos y el EDL. El script lleva la normalización de cada toma, el etalonaje, las transiciones, los rótulos, el logotipo, la mezcla con ducking y la exportación a todos los formatos que hayas pedido.',
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
            h('li', { key: '1' }, [h('strong', { key: 's' }, 'No llama a los modelos generativos. '),
              'Esta app corre en tu navegador y no puede custodiar claves de API de terceros. Produce los prompts, los parámetros y los trabajos; quien los ejecuta es el agente de KIMOS con sus conexiones, o tú desde el panel de tu proveedor. El resultado vuelve aquí al registrarlo.']),
            h('li', { key: '2' }, [h('strong', { key: 's' }, 'No renderiza el vídeo. '),
              'Genera el script de FFmpeg completo y reproducible; el render ocurre en tu máquina o en tu servidor.']),
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
          { t: 'Trabajos', d: 'La app lista qué generar, con qué modelo y a qué coste.' },
          { t: 'Generación', d: 'El agente de KIMOS o tú ejecutáis cada trabajo con el proveedor indicado.' },
          { t: 'Registro', d: 'El archivo vuelve a la Biblioteca asociado a su escena, versionado.' },
          { t: 'Liquidación', d: 'El trabajo se cierra y el coste real sustituye al estimado en Analytics.' },
        ].map((x, i, all) => h('div', { key: i, className: 'ks-guide-cyclestep' }, [
          h('strong', { key: 't' }, x.t),
          h('p', { key: 'd' }, x.d),
          i < all.length - 1 ? h('span', { className: 'ks-guide-arrow', key: 'a' }, '→') : null,
        ]))),
        h('p', { className: 'ks-hint', key: 'n' },
          'Desde el chat de KIMOS basta con pedirlo: «ejecuta los trabajos pendientes de Kreative Studio». '
          + 'El agente lee la lista, genera con sus modelos y registra cada resultado.'),
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
