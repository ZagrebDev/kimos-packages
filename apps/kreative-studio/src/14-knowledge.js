
// ═══════════════════════════════════════════════════════════════════════════
// DOMINIO · Base de conocimiento de mercado
// Alimenta al Research Agent sin depender de red. Es un modelo de categorías
// con sus códigos visuales, objeciones, disparadores de compra, arquetipos de
// competencia y estacionalidad. Ampliable: añadir una entrada = añadir un
// nicho soportado.
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  {
    id: 'apparel', label: 'Moda y textil', style: 'editorial-fashion',
    keywords: ['ropa', 'camisa', 'camiseta', 'polera', 'vestido', 'pantalon', 'chaqueta', 'moda', 'prenda', 'textil', 'zapatilla', 'calzado', 'bolso', 'gorra', 'sudadera'],
    trends: ['Consumo de segunda mano y reventa como norma cultural', 'Trazabilidad del material como argumento de venta', 'Drops limitados en vez de temporadas', 'Vídeo de prueba real (try-on) por encima del render'],
    audience: ['Compra por identidad, no por necesidad', 'Decide en menos de 5 segundos de scroll', 'Consulta reseñas de talla antes que el precio'],
    objections: ['¿Me quedará bien la talla?', '¿La calidad aguanta lavados?', '¿Cuánto tarda y cuánto cuesta devolver?'],
    triggers: ['Ver la prenda en movimiento sobre una persona real', 'Detalle macro de costura y tejido', 'Prueba social de gente parecida a mí'],
    visualCodes: ['Textura de tejido en macro', 'Movimiento del paño', 'Fondo neutro que no compite', 'Piel real sin retoque plástico'],
    competitors: ['Marca global de fast fashion (precio y volumen)', 'Marca de autor local (relato y escasez)', 'Marketplace agregador (surtido y logística)'],
    channels: ['meta-reels', 'instagram', 'tiktok', 'meta-feed'],
    seasonality: 'Picos en cambio de estación, Black Friday y rebajas.',
    priceLogic: 'valor por uso y durabilidad',
  },
  {
    id: 'sportswear', label: 'Deporte y rendimiento', style: 'epic-sport',
    keywords: ['deporte', 'running', 'gym', 'fitness', 'entrenamiento', 'atleta', 'ciclismo', 'futbol', 'crossfit', 'suplemento', 'proteina', 'creatina', 'padel', 'trail'],
    trends: ['Rendimiento medible: el dato como prueba', 'Comunidad y reto colectivo por encima del héroe solitario', 'Recuperación y sueño como nueva frontera', 'Híbrido fuerza + resistencia'],
    audience: ['Se identifica con el esfuerzo, no con el resultado', 'Confía en atletas de nicho más que en estrellas', 'Compra para sostener un hábito, no un capricho'],
    objections: ['¿De verdad mejora mi marca?', '¿Aguanta el uso intensivo?', '¿Está respaldado por evidencia?'],
    triggers: ['Prueba de resistencia en condiciones extremas', 'Antes/después medible', 'Testimonio de alguien de mi nivel'],
    visualCodes: ['Sudor y respiración visibles', 'Cámara lenta en el punto de máxima tensión', 'Contraluz sobre piel', 'Suelo, polvo, textura de esfuerzo'],
    competitors: ['Gigante deportivo (presupuesto y fichajes)', 'Marca técnica de nicho (credibilidad)', 'Marca directa al consumidor (precio y comunidad)'],
    channels: ['tiktok', 'meta-reels', 'youtube-shorts', 'meta-feed'],
    seasonality: 'Enero, primavera pre-verano y temporada de maratones.',
    priceLogic: 'inversión en rendimiento',
  },
  {
    id: 'tech', label: 'Tecnología y electrónica', style: 'tech-future',
    keywords: ['tecnologia', 'gadget', 'electronica', 'auricular', 'audifono', 'telefono', 'movil', 'laptop', 'computador', 'camara', 'drone', 'smartwatch', 'reloj inteligente', 'bateria', 'cargador', 'teclado', 'monitor'],
    trends: ['IA integrada como argumento por defecto', 'Autonomía y reparabilidad como diferencial', 'Diseño silencioso frente a la ostentación', 'Ecosistema por encima del dispositivo suelto'],
    audience: ['Compara especificaciones antes de decidir', 'Lee reseñas técnicas y ve unboxings', 'Teme la obsolescencia rápida'],
    objections: ['¿Es compatible con lo que ya tengo?', '¿Cuánto dura la batería de verdad?', '¿Habrá soporte y actualizaciones?'],
    triggers: ['Demostración de la función clave en 3 segundos', 'Comparativa honesta contra la alternativa', 'Detalle constructivo en macro'],
    visualCodes: ['Macro de materiales y mecanizado', 'Vista explotada de componentes', 'Interfaz real, no maqueta', 'Luz de gradiente sobre superficie mate'],
    competitors: ['Fabricante líder (marca y ecosistema)', 'Retador con mejor relación precio/prestaciones', 'Genérico blanco (solo precio)'],
    channels: ['youtube-instream', 'meta-feed', 'google-demand', 'youtube-shorts'],
    seasonality: 'Lanzamientos de otoño, Black Friday y vuelta al cole.',
    priceLogic: 'coste por año de uso',
  },
  {
    id: 'beauty', label: 'Belleza y cuidado personal', style: 'nordic-minimal',
    keywords: ['belleza', 'skincare', 'crema', 'serum', 'cosmetico', 'maquillaje', 'perfume', 'fragancia', 'shampoo', 'cabello', 'piel', 'labial', 'protector solar'],
    trends: ['Ingredientes explicados: el consumidor lee la fórmula', 'Rutinas más cortas y sinceras', 'Dermatología divulgada en vídeo corto', 'Envase recargable como señal de marca'],
    audience: ['Desconfía de promesas milagrosas', 'Busca resultados con evidencia y plazos', 'Compra por recomendación de pares y de profesionales'],
    objections: ['¿Sirve para mi tipo de piel?', '¿En cuánto tiempo se nota?', '¿Irrita o tiene ingredientes que evito?'],
    triggers: ['Textura del producto en macro', 'Antes/después con la misma luz', 'Explicación del principio activo en lenguaje simple'],
    visualCodes: ['Gotas y texturas en cámara lenta', 'Piel real con poros visibles', 'Fondo limpio de un solo color', 'Manos aplicando el producto'],
    competitors: ['Casa cosmética global (distribución)', 'Marca de farmacia/dermo (credibilidad clínica)', 'Marca indie viral (relato y comunidad)'],
    channels: ['tiktok', 'meta-reels', 'instagram', 'meta-feed'],
    seasonality: 'Verano (solar), invierno (hidratación) y campañas de regalo.',
    priceLogic: 'coste por aplicación',
  },
  {
    id: 'food', label: 'Alimentación y bebidas', style: 'gourmet-macro',
    keywords: ['comida', 'alimento', 'bebida', 'cafe', 'te', 'cerveza', 'vino', 'snack', 'chocolate', 'restaurante', 'gourmet', 'organico', 'salsa', 'panaderia', 'helado', 'jugo'],
    trends: ['Origen y productor con nombre propio', 'Menos azúcar y etiqueta legible', 'Formato listo para consumir sin renunciar a calidad', 'Ritual de consumo como contenido'],
    audience: ['Compra por antojo y confirma por etiqueta', 'Valora la historia del productor', 'Comparte lo que come si es fotogénico'],
    objections: ['¿Sabe tan bien como se ve?', '¿Qué lleva realmente?', '¿Justifica el precio frente al de siempre?'],
    triggers: ['Sonido y textura del primer bocado o sorbo', 'Vapor, hielo, goteo: señales de temperatura', 'Ver a alguien disfrutarlo de verdad'],
    visualCodes: ['Macro con contraluz sobre la textura', 'Movimiento de líquido a alta velocidad', 'Manos y vajilla con uso', 'Paleta cálida y apetitosa'],
    competitors: ['Gran marca de distribución (precio y presencia)', 'Artesano local (autenticidad)', 'Marca de nicho saludable (posicionamiento)'],
    channels: ['meta-reels', 'tiktok', 'instagram', 'meta-feed'],
    seasonality: 'Fiestas, verano para bebidas frías, otoño para cálidas.',
    priceLogic: 'precio por ración frente a la alternativa',
  },
  {
    id: 'home', label: 'Hogar y decoración', style: 'warm-lifestyle',
    keywords: ['hogar', 'mueble', 'decoracion', 'cocina', 'lampara', 'silla', 'mesa', 'sofa', 'colchon', 'textil hogar', 'jardin', 'limpieza', 'organizacion', 'electrodomestico'],
    trends: ['Espacios pequeños y muebles multifunción', 'Materiales naturales visibles', 'Compra guiada por vídeo de montaje real', 'Durabilidad frente a renovación constante'],
    audience: ['Necesita imaginarlo en su propio espacio', 'Compara medidas y materiales', 'Le frena el montaje y la logística'],
    objections: ['¿Cabe y combina en mi casa?', '¿Es difícil de montar?', '¿Cuánto aguanta el uso diario?'],
    triggers: ['Ver el producto en una casa real, no en estudio', 'Demostración de uso cotidiano', 'Detalle del material y del acabado'],
    visualCodes: ['Luz de ventana', 'Planos con vida doméstica alrededor', 'Detalle de junta y acabado', 'Paleta cálida y natural'],
    competitors: ['Cadena global de mobiliario (precio y catálogo)', 'Taller local (calidad y personalización)', 'Marketplace (variedad)'],
    channels: ['meta-feed', 'instagram', 'google-demand', 'meta-reels'],
    seasonality: 'Mudanzas de verano, otoño de renovación y rebajas de enero.',
    priceLogic: 'coste por año de vida útil',
  },
  {
    id: 'saas', label: 'Software y servicios', style: 'tech-future',
    keywords: ['software', 'saas', 'app', 'plataforma', 'servicio', 'agencia', 'consultoria', 'crm', 'erp', 'automatizacion', 'suscripcion', 'herramienta', 'api', 'formacion', 'curso'],
    trends: ['Precio por resultado y no por asiento', 'Adopción guiada por el usuario final, no por compras', 'Integraciones como criterio de selección', 'IA embebida esperada por defecto'],
    audience: ['Evalúa en equipo y necesita justificar el gasto', 'Prueba antes de comprometerse', 'Mide el tiempo hasta el primer valor'],
    objections: ['¿Cuánto tardo en migrar?', '¿Se integra con mi stack?', '¿Qué pasa con mis datos?'],
    triggers: ['Ver la tarea real resuelta en pantalla', 'Cifra concreta de ahorro de tiempo', 'Caso de una empresa parecida a la mía'],
    visualCodes: ['Interfaz real grabada en pantalla', 'Tipografía y datos legibles', 'Transiciones limpias entre pasos', 'Persona usando la herramienta, no posando'],
    competitors: ['Suite del gigante (ya instalada)', 'Especialista vertical (mejor encaje)', 'Solución casera en hoja de cálculo'],
    channels: ['linkedin', 'google-search', 'youtube-instream', 'meta-feed'],
    seasonality: 'Cierres de trimestre y presupuestos de enero.',
    priceLogic: 'retorno sobre horas ahorradas',
  },
  {
    id: 'jewelry', label: 'Joyería y relojería', style: 'luxury-noir',
    keywords: ['joya', 'joyeria', 'anillo', 'collar', 'pulsera', 'reloj', 'oro', 'plata', 'diamante', 'pendiente', 'lujo'],
    trends: ['Piezas para uso diario, no solo ceremonia', 'Origen ético de la piedra y del metal', 'Autocompra femenina como segmento dominante', 'Personalización grabada'],
    audience: ['Compra por significado y por permanencia', 'Necesita confianza absoluta en el vendedor', 'Se toma tiempo antes de decidir'],
    objections: ['¿Es auténtico y certificado?', '¿Se estropea con el uso diario?', '¿Puedo devolverlo o ajustarlo?'],
    triggers: ['Brillo real en macro con movimiento', 'Historia detrás de la pieza', 'Garantía y certificado visibles'],
    visualCodes: ['Fondo negro con una sola fuente', 'Destellos controlados en el bisel', 'Piel y metal en contacto', 'Movimiento lentísimo'],
    competitors: ['Maison histórica (prestigio)', 'Marca digital directa (precio transparente)', 'Joyero local (confianza personal)'],
    channels: ['instagram', 'meta-feed', 'google-demand', 'meta-reels'],
    seasonality: 'San Valentín, día de la madre, navidad y temporada de bodas.',
    priceLogic: 'valor permanente frente a moda pasajera',
  },
  {
    id: 'auto', label: 'Automoción y movilidad', style: 'premium-cinematic',
    keywords: ['auto', 'coche', 'vehiculo', 'moto', 'bicicleta', 'electrico', 'motor', 'neumatico', 'scooter', 'camioneta', 'suv'],
    trends: ['Electrificación y ansiedad de autonomía', 'Software del vehículo como diferencial', 'Suscripción y renting frente a propiedad', 'Seguridad demostrada con datos'],
    audience: ['Decisión larga y muy racionalizada', 'Consulta pruebas independientes', 'Compra emocional justificada con datos'],
    objections: ['¿Cuánto cuesta mantenerlo?', '¿Autonomía real en mi uso?', '¿Cuánto pierde de valor?'],
    triggers: ['Vídeo de conducción en carretera real', 'Detalle de habitáculo y materiales', 'Cifras de consumo y seguridad'],
    visualCodes: ['Travelling paralelo al vehículo', 'Reflejos de luz sobre carrocería', 'Amanecer o noche urbana', 'Detalle de rueda y suspensión'],
    competitors: ['Fabricante tradicional (red y servicio)', 'Marca eléctrica nativa (tecnología)', 'Mercado de ocasión (precio)'],
    channels: ['youtube-instream', 'meta-feed', 'google-demand', 'instagram'],
    seasonality: 'Salones de otoño, primavera de compra y cierres de año fiscal.',
    priceLogic: 'coste total de propiedad',
  },
  {
    id: 'kids', label: 'Infantil, bebé y mascotas', style: 'warm-lifestyle',
    keywords: ['bebe', 'nino', 'infantil', 'juguete', 'cuna', 'panal', 'mascota', 'perro', 'gato', 'pienso', 'colegio', 'escolar'],
    trends: ['Seguridad certificada como primer filtro', 'Materiales sin tóxicos y sostenibles', 'Recomendación de pediatras y veterinarios en vídeo', 'Diseño que agrada también al adulto'],
    audience: ['Decide con miedo a equivocarse', 'Pregunta en comunidades antes de comprar', 'Paga más por seguridad demostrada'],
    objections: ['¿Es seguro?', '¿Está certificado?', '¿Aguanta el uso y el lavado?'],
    triggers: ['Ver a un niño o mascota real usándolo', 'Certificación explícita en pantalla', 'Testimonio de otro padre o dueño'],
    visualCodes: ['Luz suave y cálida', 'Manos adultas y pequeñas juntas', 'Texturas blandas', 'Sin sobreproducción'],
    competitors: ['Marca de gran distribución (precio)', 'Marca especializada (seguridad)', 'Tienda local de barrio (consejo)'],
    channels: ['meta-feed', 'instagram', 'meta-reels', 'google-demand'],
    seasonality: 'Navidad, vuelta al cole y nacimientos todo el año.',
    priceLogic: 'tranquilidad por euro gastado',
  },
  {
    id: 'general', label: 'Producto general', style: 'premium-cinematic',
    keywords: [],
    trends: ['El vídeo corto vertical concentra el descubrimiento', 'La prueba social pesa más que el mensaje de marca', 'Los primeros 2 segundos deciden la retención', 'Se espera transparencia de precio y de origen'],
    audience: ['Decide rápido y compara', 'Necesita entender el beneficio sin esfuerzo', 'Desconfía de la promesa sin prueba'],
    objections: ['¿Para qué lo necesito?', '¿Por qué a este precio?', '¿Y si no me convence?'],
    triggers: ['Beneficio evidente en los primeros segundos', 'Demostración honesta', 'Garantía clara'],
    visualCodes: ['Producto como protagonista', 'Fondo que no compite', 'Luz que revela la forma', 'Movimiento suave y continuo'],
    competitors: ['Líder de categoría', 'Alternativa económica', 'No comprar nada'],
    channels: ['meta-reels', 'tiktok', 'meta-feed', 'google-demand'],
    seasonality: 'Picos de campaña comercial y fin de año.',
    priceLogic: 'valor percibido frente a alternativa',
  },
];

const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

/** Detecta la categoría a partir del texto libre del brief. */
function detectCategory(text) {
  const t = norm(text);
  if (!t) return categoryById('general');
  let best = null; let bestScore = 0;
  for (const c of CATEGORIES) {
    let sc = 0;
    for (const k of c.keywords) if (t.indexOf(norm(k)) >= 0) sc += k.length > 5 ? 2 : 1;
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  return best || categoryById('general');
}

/** Segmentos de público con su lenguaje y su driver dominante. */
const AUDIENCES = [
  { id: 'athletes', label: 'Deportistas', keywords: ['deportista', 'atleta', 'runner', 'gym', 'crossfit', 'ciclista', 'futbolista', 'entrena'],
    age: '18-40', driver: 'rendimiento y superación', language: 'directo, imperativo, con jerga técnica del deporte',
    proof: 'datos de rendimiento y testimonio de un igual', channelBias: ['tiktok', 'meta-reels', 'youtube-shorts'] },
  { id: 'genz', label: 'Generación Z', keywords: ['joven', 'gen z', 'adolescente', 'universitario', 'tiktok', 'zoomer'],
    age: '16-26', driver: 'identidad y pertenencia', language: 'coloquial, con humor, sin corporativismo',
    proof: 'creadores reales y comentarios', channelBias: ['tiktok', 'meta-reels', 'youtube-shorts'] },
  { id: 'professionals', label: 'Profesionales y empresas', keywords: ['profesional', 'empresa', 'b2b', 'directivo', 'pyme', 'equipo', 'negocio', 'emprendedor'],
    age: '28-55', driver: 'eficiencia y retorno', language: 'preciso, con cifras y sin adjetivos vacíos',
    proof: 'caso de éxito medible', channelBias: ['linkedin', 'google-search', 'youtube-instream'] },
  { id: 'parents', label: 'Familias', keywords: ['padre', 'madre', 'familia', 'hijo', 'bebe', 'papa', 'mama', 'crianza'],
    age: '28-45', driver: 'seguridad y tiempo', language: 'cercano, empático, en segunda persona',
    proof: 'certificaciones y opinión de otros padres', channelBias: ['meta-feed', 'instagram', 'google-demand'] },
  { id: 'luxury', label: 'Alto poder adquisitivo', keywords: ['lujo', 'premium', 'exclusivo', 'alto', 'vip', 'coleccionista'],
    age: '35-65', driver: 'distinción y permanencia', language: 'sobrio, elíptico, sin precio en primer plano',
    proof: 'artesanía, origen y escasez', channelBias: ['instagram', 'meta-feed', 'youtube-instream'] },
  { id: 'value', label: 'Compra inteligente', keywords: ['barato', 'ahorro', 'economico', 'oferta', 'descuento', 'precio', 'accesible'],
    age: '22-60', driver: 'máximo valor por su dinero', language: 'claro, con la cifra por delante',
    proof: 'comparativa de precio y garantía', channelBias: ['meta-feed', 'google-demand', 'tiktok'] },
  { id: 'creators', label: 'Creadores y creativos', keywords: ['creador', 'creativo', 'disenador', 'fotografo', 'artista', 'musico', 'streamer'],
    age: '20-40', driver: 'expresión y herramientas que no estorban', language: 'inspirador y muy visual',
    proof: 'resultado final logrado con el producto', channelBias: ['instagram', 'tiktok', 'youtube-shorts'] },
  { id: 'general', label: 'Público general', keywords: [],
    age: '25-55', driver: 'resolver un problema cotidiano', language: 'claro y sin tecnicismos',
    proof: 'demostración y reseñas', channelBias: ['meta-reels', 'meta-feed', 'tiktok'] },
];
const audienceById = (id) => AUDIENCES.find((a) => a.id === id) || AUDIENCES[AUDIENCES.length - 1];

function detectAudience(text) {
  const t = norm(text);
  let best = null; let bestScore = 0;
  for (const a of AUDIENCES) {
    let sc = 0;
    for (const k of a.keywords) if (t.indexOf(norm(k)) >= 0) sc += 2;
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best || audienceById('general');
}

/**
 * Reglas de intención: traducen la frase del usuario en decisiones.
 *
 * `objective` es una decisión EXPLÍCITA («que convierta», «lanzamiento») y
 * gana siempre. `objectiveHint` es lo que un estilo sugiere por defecto y solo
 * se aplica si la frase no dice nada del objetivo — si no, «un comercial épico
 * que convierta» acabaría siendo de notoriedad solo porque «épico» aparece
 * antes en la lista.
 */
const INTENT_RULES = [
  { re: /(premium|lujo|exclusiv|alta gama|sofistic|elegan)/, style: 'premium-cinematic', tone: 'aspiracional', objectiveHint: 'awareness' },
  { re: /(epic|epico|potente|brutal|impacto|adrenalin)/, style: 'epic-sport', tone: 'intenso', objectiveHint: 'awareness' },
  { re: /(deportist|atleta|gym|entrenar|rendimiento|fitness)/, style: 'epic-sport', audience: 'athletes', tone: 'intenso' },
  { re: /(minimal|limpio|simple|sencill|zen|calma)/, style: 'nordic-minimal', tone: 'sereno' },
  { re: /(viral|tiktok|joven|gen z|divertid|gracios|meme)/, style: 'street-energy', audience: 'genz', tone: 'desenfadado' },
  { re: /(tecnolog|futurist|innova|ia\b|inteligencia artificial|software|saas)/, style: 'tech-future', tone: 'preciso' },
  { re: /(comida|sabor|gourmet|delicios|apetit|bebida)/, style: 'gourmet-macro', tone: 'sensorial' },
  { re: /(moda|fashion|editorial|pasarela|estilismo)/, style: 'editorial-fashion', tone: 'aforistico' },
  { re: /(familiar|hogar|cotidian|cercano|natural|autentic)/, style: 'warm-lifestyle', tone: 'calido' },
  { re: /(retro|vintage|noventa|nostalg|ochenta)/, style: 'retro-90s', tone: 'nostalgico' },
  { re: /(noir|oscur|misterio|seduc|perfume|deseo|nocturn)/, style: 'luxury-noir', tone: 'evocador' },
  // «convierta», «convertir», «conversión»: la raíz cambia por diptongación.
  { re: /(vender|vende|venta|convier|convert|convers|compra|roas|cpa|checkout)/, objective: 'conversion' },
  { re: /(lanzamiento|lanzar|estreno|nuevo producto|preventa)/, objective: 'launch' },
  { re: /(remarketing|retargeting|carrito|abandon|recuperar)/, objective: 'remarketing' },
  { re: /(notoriedad|awareness|dar a conocer|marca|alcance)/, objective: 'awareness' },
  { re: /(consideracion|comparar|evaluar|educar)/, objective: 'consideration' },
  { re: /(barato|economic|ahorr|descuento|oferta)/, audience: 'value' },
  { re: /(empresa|b2b|profesional|pyme|equipos de trabajo)/, audience: 'professionals' },
  { re: /(familia|padres|madres|hijos|bebe)/, audience: 'parents' },
  { re: /(creador|creativ|fotograf|disenador|artista)/, audience: 'creators' },
];

/**
 * Traduce una intención en lenguaje natural a decisiones de campaña.
 * "Quiero un comercial épico para deportistas que convierta"
 *   → { styleId:'epic-sport', audienceId:'athletes', objectiveId:'conversion' }
 */
function parseIntent(text, brief) {
  const t = norm(text);
  const out = { styleId: null, audienceId: null, objectiveId: null, tone: null, matched: [] };
  let objectiveHint = null;
  for (const r of INTENT_RULES) {
    if (!r.re.test(t)) continue;
    out.matched.push(r.re.source);
    if (r.style && !out.styleId) out.styleId = r.style;
    if (r.audience && !out.audienceId) out.audienceId = r.audience;
    if (r.objective && !out.objectiveId) out.objectiveId = r.objective;
    if (r.objectiveHint && !objectiveHint) objectiveHint = r.objectiveHint;
    if (r.tone && !out.tone) out.tone = r.tone;
  }
  if (!out.objectiveId) out.objectiveId = objectiveHint;
  // Coincidencia directa con el nombre o las palabras clave de un estilo.
  if (!out.styleId) {
    for (const st of STYLES) {
      if (norm(st.name) && t.indexOf(norm(st.name)) >= 0) { out.styleId = st.id; break; }
      if (st.keywords.some((k) => t.indexOf(norm(k)) >= 0)) { out.styleId = st.id; break; }
    }
  }
  const cat = detectCategory([t, s(brief && brief.productName), s(brief && brief.category)].join(' '));
  if (!out.styleId) out.styleId = cat.style;
  if (!out.audienceId) out.audienceId = detectAudience(t + ' ' + s(brief && brief.audienceHint)).id;
  if (!out.objectiveId) out.objectiveId = 'awareness';
  out.categoryId = cat.id;
  // Duración deseada si el usuario la menciona ("de 15 segundos", "1 minuto").
  const mSec = /(\d{1,3})\s*(segundos|segs?|s\b)/.exec(t);
  const mMin = /(\d{1,2})\s*(minutos?|min\b)/.exec(t);
  out.durationSec = mMin ? clamp(num(mMin[1], 1) * 60, 5, 180)
    : mSec ? clamp(num(mSec[1], 20), 5, 180) : null;
  return out;
}
