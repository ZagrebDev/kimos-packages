/**
 * Estudio de Mercado — app instalable de KIMOS.
 *
 * Bundle ESM autocontenido: usa globalThis.React (nunca su propia copia) y
 * React.createElement (el host no compila JSX). Los datos del estudio viven en
 * src/data.json y el sistema visual en src/visual.json; `build.mjs` los inyecta
 * donde dicen DATOS_INLINE y VISUAL_INLINE.
 *
 * Todo número visible se recalcula desde los supuestos editables: no hay
 * resultados congelados. Esa es la diferencia con la planilla original.
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '2.0.0';

const DATA = {"meta":{"fecha":"2026-08-16","moneda":"USD","fuente":"KIMOS - Estudio de mercado y modelo de precios (planilla + dashboard, ago-2026)","ampliacion":"2026-09-01"},"supuestos":{"usuarios":10,"canales":5,"factor":0.55,"descAnual":0.2},"modulos":[{"n":1,"app":"Escritorio Kimos","que":"Control del escritorio, apertura de aplicaciones y chat entre agentes","cat":"AI Workspace / agente de escritorio","alt":"ChatGPT Business, Claude Team, M365 Copilot, Manus","target":"Toda la base instalada","pro":"Es el único módulo que ningún competidor replica dentro de una suite: los demás venden el asistente aparte de las apps. Orquestar agentes sobre datos propios elimina el copy-paste entre herramientas.","contra":"Compite contra OpenAI y Microsoft, que subsidian el precio. La calidad depende de modelos de terceros: si sube el costo del token, sube tu costo variable y no lo controlas.","estrategia":"Ancla de la suite: incluir en todos los planes, nunca vender suelto","conf":"4/5","ventaja":8,"icono":"monitor"},{"n":2,"app":"Agentes","que":"Agentes IA internos que ejecutan tareas del negocio","cat":"Constructor de agentes IA","alt":"Zapier, Lindy, Relevance AI, Notion Agents","target":"Equipos de operaciones","pro":"Los agentes ya viven donde están los datos (CRM, archivos, productos). Zapier y Lindy tienen que conectarse por API a todo y pagan ese costo en latencia y fragilidad.","contra":"Categoría con el ciclo de innovación más rápido del mercado y jugadores con capital ilimitado. El costo por crédito es difícil de proyectar y erosiona margen si se subestima.","estrategia":"Base fija baja + cobro por créditos de consumo","conf":"6/6","ventaja":6,"icono":"bot"},{"n":3,"app":"Agentes Web","que":"Chatbots y vendedores web (ej. vendedor_figit.ai)","cat":"Chatbot / agente conversacional web","alt":"Tidio, Intercom Fin, Chatbase, Crisp, ManyChat","target":"E-commerce y equipos de soporte","pro":"El bot conoce el catálogo real (módulo Productos) y el pipeline (Prospección), no un PDF cargado a mano. Ese contexto es exactamente lo que Chatbase no puede dar.","contra":"Intercom domina el segmento medio-alto con una marca enorme y Tidio el bajo con precio agresivo. Sin volumen de conversaciones, el modelo por resolución de Intercom sale más barato.","estrategia":"Módulo premium: alto valor percibido y ROI demostrable","conf":"9/9","ventaja":7,"icono":"message"},{"n":4,"app":"Archivos","que":"Gestor documental de la organización","cat":"Almacenamiento y gestión documental","alt":"Google Workspace, Dropbox Business, Box, Egnyte","target":"Toda la base instalada","pro":"Los archivos quedan junto a las tareas, productos y clientes que los originan, sin una capa de integración de por medio.","contra":"Es la categoría más comoditizada que existe y compite contra almacenamiento a escala de Google. Nadie cambia de proveedor de archivos por si solo: solo migra si migra todo.","estrategia":"Commodity: incluir en el core, jamás vender suelto","conf":"7/7","ventaja":2,"icono":"folder"},{"n":5,"app":"Conocimiento","que":"Base de conocimiento corporativa","cat":"Knowledge base / wiki con IA","alt":"Confluence, Guru, Slite, Notion, Document360","target":"Equipos de 10+ personas","pro":"La búsqueda alimenta directamente a los agentes: el conocimiento no es un repositorio muerto sino el contexto que consume el resto de la suite.","contra":"Notion y Confluence tienen ecosistemas de plantillas y comunidades que tomaron una década construir. Migrar documentación es doloroso y frena la venta.","estrategia":"Incluir en el core; diferenciar con búsqueda IA nativa","conf":"5/5","ventaja":4,"icono":"book"},{"n":6,"app":"Equipos","que":"Colaboración y comunicación por equipo","cat":"Colaboración / chat de equipo","alt":"Slack, Microsoft Teams, Google Chat","target":"Toda la base instalada","pro":"Conversación pegada al trabajo, sin saltar entre Slack y el gestor de tareas.","contra":"Es la categoría más difícil de desplazar del mercado: el chat tiene efecto de red y Teams viene gratis con Microsoft 365. Recomendación honesta: no pelear aquí, integrarse.","estrategia":"Commodity: incluir en el core","conf":"5/5","ventaja":1,"icono":"users"},{"n":7,"app":"Kanban","que":"Tableros de tareas y flujos de trabajo","cat":"Gestión de tareas Kanban","alt":"Trello, ClickUp, Monday.com, Asana, Jira","target":"Todos los equipos","pro":"Funcionalidad de paridad razonable y es el módulo más fácil de adoptar sin capacitación. Buen caballo de Troya para entrar a la cuenta.","contra":"Mercado saturado con Trello a USD 5 y ClickUp a USD 7. Cero disposición a pagar más que el líder, y el costo de cambio para el cliente es bajísimo.","estrategia":"Módulo de entrada con precio agresivo: sirve para adquirir, no para monetizar","conf":"9/9","ventaja":3,"icono":"columns"},{"n":8,"app":"Planificación (Gantt)","que":"Planificación de proyectos en diagrama de Gantt","cat":"Planificación de proyectos / Gantt","alt":"Smartsheet, Wrike, MS Project, TeamGantt, Instagantt","target":"PMOs y consultoras","pro":"Vendido junto a Kanban da una propuesta que Trello no tiene y Smartsheet cobra a USD 19.","contra":"MS Project es el estándar de facto en organizaciones grandes por inercia. Gantt suelto es un producto de nicho: casi nadie lo compra aislado.","estrategia":"Vender empaquetado con Kanban como módulo único de gestión de proyectos","conf":"8/8","ventaja":4,"icono":"calendar"},{"n":9,"app":"Notas de Equipo","que":"Notas colaborativas y seguimiento de modificaciones","cat":"Notas colaborativas / docs","alt":"Notion, Coda, Evernote Teams, Slite","target":"Toda la base instalada","pro":"Las notas se vinculan a tareas y clientes reales en vez de vivir en un documento aislado.","contra":"Notion define la categoría y tiene una comunidad gigantesca de plantillas. Competir de frente en features de documento es una batalla pérdida.","estrategia":"Incluir en el core","conf":"5/5","ventaja":3,"icono":"note"},{"n":10,"app":"HTML Panel / Dashboards","que":"Paneles HTML personalizados (BSC, análisis estratégico)","cat":"Dashboards y paneles embebidos","alt":"Retool, Power BI, Tableau, Geckoboard","target":"Gerencia y dirección","pro":"Los datos ya están dentro de la suite: no hay ETL ni conectores que mantener. Power BI necesita una capa de integración completa para llegar a lo mismo.","contra":"Power BI a USD 14 con el peso de Microsoft detras es difícil de superar en percepción. Requiere perfiles técnicos para armar los paneles y eso encarece el onboarding.","estrategia":"Diferenciador técnico: módulo premium con servicios de implementación","conf":"7/7","ventaja":6,"icono":"chart"},{"n":11,"app":"FossFLOW (BPM)","que":"Gestión y automatización de procesos de negocio, con supervisión por etapa","cat":"BPM / automatización de procesos","alt":"Pipefy, Kissflow, Nintex, Process Street, monday.com","target":"Empresas con procesos regulados","pro":"Categoría con precios altos y competidores caros o pesados: Kissflow parte en USD 2.500/mes de plataforma y Nintex en USD 1.405. Hay mucho espacio para entrar por debajo con algo usable.","contra":"Es el módulo más difícil de construir bien: motor de reglas, versionado, auditoría y cumplimiento. Vender BPM exige consultoría y ciclos de venta largos.","estrategia":"Módulo premium: es donde el ticket sube sin resistencia","conf":"5/6","ventaja":7,"icono":"flow"},{"n":12,"app":"Digitai (automatización IA)","que":"Gestión y automatización de tareas de IA y procesamiento de datos","cat":"Automatización IA / orquestación de datos","alt":"Dify, Flowise, n8n, Relevance AI","target":"Equipos técnicos","pro":"Complementa a los Agentes con el pipeline de datos que los alimenta. Precios de referencia razonables (Dify USD 59, n8n USD 24) dejan margen.","contra":"Se solapa fuerte con el módulo Agentes: dos productos que el cliente percibe como uno. Además compite contra open source gratuito y autohospedable, que es un techo de precio duro.","estrategia":"Cobro por consumo; evaluar fusionarlo con Agentes","conf":"5/6","ventaja":4,"icono":"cpu"},{"n":13,"app":"Formularios de Contacto","que":"Administración de formularios de contacto","cat":"Formularios y captura de leads","alt":"Typeform, Jotform, Tally, Fillout","target":"Marketing y ventas","pro":"El lead entra directo al CRM sin Zapier de por medio. Typeform cobra USD 29 solo por 100 respuestas al mes.","contra":"Tally regala respuestas ilimitadas en su plan free: el piso de precio de la categoría tiende a cero. No es un módulo del que se pueda vivir.","estrategia":"Gancho de entrada freemium con límite de respuestas","conf":"8/8","ventaja":3,"icono":"form"},{"n":14,"app":"Prospección Comercial","que":"Gestión y seguimiento de prospección de clientes","cat":"CRM / prospección de ventas","alt":"Pipedrive, HubSpot, Apollo.io, Salesforce","target":"Equipos comerciales","pro":"Es donde el cliente ya acepta pagar USD 39-100 por asiento. Integrado con Agentes Web y Formularios cierra el ciclo completo de lead a venta, algo que Pipedrive solo hace comprando add-ons.","contra":"Categoría con costo de cambio altísimo: nadie migra su CRM a la ligera. Salesforce y HubSpot tienen ecosistemas de partners que KIMOS no puede igualar en el corto plazo.","estrategia":"El módulo con mayor disposición a pagar de toda la suite","conf":"12/12","ventaja":7,"icono":"target"},{"n":15,"app":"Social Planner","que":"Planificación de contenido en redes sociales","cat":"Gestión y programación de redes","alt":"Buffer, Hootsuite, Metricool, Later, Sprout Social","target":"Marketing y agencias","pro":"Junto a Kreative Studio cubre crear y publicar en un solo lugar; Buffer y Hootsuite solo publican.","contra":"Depende de APIs de terceros (Meta, TikTok, LinkedIn) que cambian sin aviso y obligan a mantenimiento constante. Metricool a USD 18 fija un techo bajo.","estrategia":"Cobrar por canal conectado, nunca por usuario","conf":"7/7","ventaja":4,"icono":"share"},{"n":16,"app":"Kreative Studio","que":"Creación de contenido visual: posts, banners, logos y material gráfico","cat":"Diseño gráfico / contenido visual","alt":"Canva, Adobe Express, Figma, VistaCreate","target":"Marketing y disenadores","pro":"El diseño conectado al catálogo de productos y al calendario de publicación es un flujo que Canva no tiene cerrado.","contra":"Canva tiene 200+ millones de usuarios, una biblioteca de plantillas imposible de replicar y cobra USD 10. Competir en features de diseño puro no es realista.","estrategia":"Vender junto a Social Planner como paquete de marketing","conf":"3/4","ventaja":3,"icono":"palette"},{"n":17,"app":"Kimos FunPlai (gamificación)","que":"Gamificación y experiencias interactivas: juegos, concursos y actividades lúdicas","cat":"Gamificación y engagement","alt":"Kahoot!, Spinify, Mentimeter, TalentLMS, Gametize","target":"RRHH, marketing y eventos","pro":"Categoría fragmentada y sin líder claro en el mundo hispano. Conectado a Equipos y Eventos permite gamificar procesos internos reales, no solo trivias sueltas.","contra":"Uso episódico: la gente lo usa para una campaña y lo abandona, lo que produce churn alto si se cobra mensual. Kahoot domina el reconocimiento de marca en lo educativo.","estrategia":"Add-on por campaña o por evento, no suscripción mensual fija","conf":"4/6","ventaja":5,"icono":"game"},{"n":18,"app":"ProductLab","que":"Gestión de producto, investigación y desarrollo","cat":"Product management / roadmap","alt":"Productboard, Aha!, Airfocus, Jira Product Discovery","target":"Empresas con equipo de producto","pro":"Precios de referencia altos (Productboard Pro USD 80, Aha! USD 59) y competidores percibidos como caros y complejos.","contra":"Nicho estrecho: solo lo compran empresas con equipo de producto formal. En Latinoamérica ese perfil es escaso y alarga el ciclo de venta.","estrategia":"Nicho de ticket alto: pocos asientos, precio elevado por asiento","conf":"7/7","ventaja":5,"icono":"flask"},{"n":19,"app":"Productos (PIM)","que":"Gestión de catálogos de productos","cat":"PIM / catálogo de productos","alt":"Plytix, Akeneo, Salsify, Sales Layer","target":"Retail, distribución y manufactura","pro":"La brecha de precio es enorme: Plytix cobra USD 499 y Akeneo parte en USD 45.000 al año. Integrado con Tienda y Vitrina, KIMOS cubre el ciclo entero que Plytix vende como add-ons de USD 300 cada uno.","contra":"PIM es intensivo en calidad de datos y migración: el proyecto se juega en la implementación, no en el software. Exige un equipo de soporte técnico sólido.","estrategia":"Tarifa plana por volumen de SKU con asientos ilimitados","conf":"4/5","ventaja":8,"icono":"box"},{"n":20,"app":"Tienda (e-commerce)","que":"Tienda en línea","cat":"E-commerce / storefront","alt":"Shopify, BigCommerce, Wix, WooCommerce","target":"Retail y PyMEs con venta online","pro":"Con PIM y Vitrina integrados, la tienda se alimenta sola desde el catálogo maestro.","contra":"Shopify es un monopolio blando con un app store de miles de integraciones. Sin ese ecosistema, la tienda de KIMOS será funcionalmente más pobre por varios años. Recomendación honesta: integrarse con Shopify antes que competirle.","estrategia":"Tarifa plana; evaluar comisión sobre GMV solo en tiers bajos","conf":"7/7","ventaja":2,"icono":"cart"},{"n":21,"app":"Vitrina (catálogo digital)","que":"Vitrina pública de productos y marca","cat":"Catálogo digital / brand portal","alt":"Linktree, Flipsnack, Plytix Brand Portals","target":"Retail y marcas","pro":"Plytix cobra USD 300 por el mismo add-on. Como complemento del PIM es margen casi puro.","contra":"Es una feature, no un producto: nadie contrata una suite por su vitrina. Vendida suelta compite con Linktree a USD 9.","estrategia":"Add-on económico sobre Productos o Tienda","conf":"1/5","ventaja":5,"icono":"store"},{"n":22,"app":"KIMOS Cashflow","que":"Gestión del flujo de caja","cat":"Gestión y proyección de flujo de caja","alt":"Float, Fathom, Agicap, Dryrun","target":"Gerencia financiera y PyMEs","pro":"Categoría con precios sanos (Float USD 49-199, Fathom hasta USD 260) y competidores extranjeros con poca adaptación tributaria local.","contra":"Exige integración con bancos y ERPs locales para ser útil de verdad, y eso es trabajo país por país. Sin conciliación automática queda en una planilla bonita.","estrategia":"Tarifa plana por empresa, nunca por usuario","conf":"5/6","ventaja":6,"icono":"coins"},{"n":23,"app":"Gestión de Eventos","que":"Gestión de eventos corporativos (Desayuno Ciberseguridad 2026)","cat":"Gestión de eventos","alt":"Luma, Eventbrite, Bizzabo, Cvent","target":"Marketing corporativo","pro":"El evento se conecta al CRM y a los formularios: los asistentes se vuelven leads automáticamente. Bizzabo cobra USD 499 por usuario para hacer eso mismo.","contra":"Uso estacional con churn natural. Luma es gratis y muy bueno para eventos chicos, lo que aplasta el precio en el segmento de entrada.","estrategia":"Cobrar por evento o campaña, no como suscripción mensual","conf":"3/5","ventaja":4,"icono":"ticket"},{"n":24,"app":"Integraciones","que":"Conexión con sistemas externos","cat":"iPaaS / automatización","alt":"Zapier, Make, n8n","target":"Toda la base instalada","pro":"Al vivir dentro de la suite evita el costo de conectar cada app entre si, que es justamente el problema que Zapier existe para resolver.","contra":"Make cobra USD 9 por 10.000 operaciones y n8n es gratis autohospedado. El techo de precio es muy bajo y el valor solo aparece hacia afuera de la suite.","estrategia":"Incluir en el core y cobrar por volumen de ejecuciones","conf":"4/4","ventaja":3,"icono":"plug"},{"n":25,"app":"Estudio de Mercado","que":"Tablero de estudio del mercado competitivo: precios de la competencia normalizados al cliente tipo, precio sugerido por línea de producto, mercado por país y economía por cliente, recalculado en vivo","cat":"Inteligencia competitiva y estudios de mercado","alt":"Crayon, Klue, AlphaSense, Contify, Kompyte, Statista, Similarweb, Semrush, Attest","target":"Dirección y áreas comerciales de la base instalada; también se vende suelto","pro":"La categoría entera vive de vender datos sin modelo: Crayon y Klue entregan tarjetas de batalla, Statista y Similarweb entregan cifras, y el trabajo de convertir eso en un precio sigue siendo una planilla hecha a mano. Aquí el estudio ES el modelo: cambiar un supuesto mueve los planes, el mercado y el LTV en la misma pantalla. Además parte con los datos que las otras apps de la suite ya tienen —costos, clientes, pedidos—, que es justo lo que una plataforma externa nunca ve.","contra":"Es el único módulo donde el competidor tiene un activo que no se copia con software: el panel de datos propio. AlphaSense y Statista cobran cinco cifras al año porque venden acceso a fuentes licenciadas, no interfaz. KIMOS no tiene ese panel, así que la calidad del estudio depende de la investigación que se cargue en cada caso; sin protocolo y sin fuentes, la herramienta produce números bonitos e inservibles. Por eso la app obliga a declarar fuente y nivel de confianza fila por fila.","estrategia":"Complemento, no parte de los planes: se vende aparte y por eso no entra en Core, Starter, Business ni Enterprise","conf":"9/16","ventaja":6.5,"icono":"target"}],"competidores":[{"row":0,"app":"Escritorio Kimos","comp":"ChatGPT Business","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Enterprise ~USD 60/asiento","fuente":"coworker.ai/blog/chatgpt-enterprise-pricing","conf":"Verificado"},{"row":1,"app":"Escritorio Kimos","comp":"ChatGPT Team","plan":"Team","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"coworker.ai/blog/chatgpt-enterprise-pricing","conf":"Verificado"},{"row":2,"app":"Escritorio Kimos","comp":"Claude Team","plan":"Team","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 5 asientos","fuente":"fusioncomputing.ca/copilot-vs-chatgpt-vs-claude","conf":"Verificado"},{"row":3,"app":"Escritorio Kimos","comp":"Microsoft 365 Copilot","plan":"Business","precio":21,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 18 promocional hasta sep-2026; exige licencia M365","fuente":"geotoolbox.ai/blog/copilot-pricing","conf":"Verificado"},{"row":4,"app":"Escritorio Kimos","comp":"Manus","plan":"Starter","precio":19,"unidad":"Plano","seg":"PyME / Empresa","nota":"Agente autónomo por créditos","fuente":"manus.im/pricing","conf":"Estimado"},{"row":5,"app":"Agentes","comp":"Zapier","plan":"Professional","precio":19.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"Free con 100 tareas/mes","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":6,"app":"Agentes","comp":"Zapier","plan":"Team","precio":69,"unidad":"Plano","seg":"PyME / Empresa","nota":"Usuarios ilimitados","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":7,"app":"Agentes","comp":"Lindy","plan":"Plus","precio":49.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"Cobro por créditos, sobreconsumo al doble","fuente":"coworker.ai/blog/lindy-ai-pricing","conf":"Verificado"},{"row":8,"app":"Agentes","comp":"Lindy","plan":"Pro","precio":99.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"coworker.ai/blog/lindy-ai-pricing","conf":"Verificado"},{"row":9,"app":"Agentes","comp":"Lindy","plan":"Max","precio":199.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"coworker.ai/blog/lindy-ai-pricing","conf":"Verificado"},{"row":10,"app":"Agentes","comp":"Notion","plan":"Business (Agents)","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Agentes custom: USD 10 / 1.000 créditos","fuente":"notion.com/pricing","conf":"Verificado"},{"row":11,"app":"Agentes Web","comp":"Tidio","plan":"Starter","precio":24.17,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tidio.com/pricing","conf":"Verificado"},{"row":12,"app":"Agentes Web","comp":"Tidio","plan":"Growth","precio":49.17,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tidio.com/pricing","conf":"Verificado"},{"row":13,"app":"Agentes Web","comp":"Tidio","plan":"Plus","precio":300,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tidio.com/pricing","conf":"Verificado"},{"row":14,"app":"Agentes Web","comp":"Intercom","plan":"Essential","precio":29,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Fin AI: USD 0,99 por resolución","fuente":"flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison","conf":"Verificado"},{"row":15,"app":"Agentes Web","comp":"Intercom","plan":"Advanced","precio":85,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Incluye 20 asientos Lite","fuente":"flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison","conf":"Verificado"},{"row":16,"app":"Agentes Web","comp":"Intercom","plan":"Expert","precio":132,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison","conf":"Verificado"},{"row":17,"app":"Agentes Web","comp":"Chatbase","plan":"Standard","precio":120,"unidad":"Plano","seg":"PyME / Empresa","nota":"4.000 créditos; sobrecosto USD 40/1.000","fuente":"blog.fastbots.ai/ai-chatbot-pricing-comparison","conf":"Verificado"},{"row":18,"app":"Agentes Web","comp":"Crisp","plan":"Essentials","precio":103,"unidad":"Plano","seg":"PyME / Empresa","nota":"EUR 95 convertidos","fuente":"featurebase.app/blog/crisp-vs-intercom","conf":"Verificado"},{"row":19,"app":"Agentes Web","comp":"ManyChat","plan":"Pro","precio":14,"unidad":"Plano","seg":"PyME / Empresa","nota":"250 contactos activos; USD 139 con 25.000","fuente":"elfsight.com/blog/how-much-does-a-chatbot-cost","conf":"Verificado"},{"row":20,"app":"Archivos","comp":"Google Workspace","plan":"Business Starter","precio":7,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"30 GB por usuario","fuente":"workspace.google.com/pricing","conf":"Verificado"},{"row":21,"app":"Archivos","comp":"Google Workspace","plan":"Business Standard","precio":14,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"2 TB por usuario","fuente":"workspace.google.com/pricing","conf":"Verificado"},{"row":22,"app":"Archivos","comp":"Google Workspace","plan":"Business Plus","precio":22,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"5 TB por usuario","fuente":"workspace.google.com/pricing","conf":"Verificado"},{"row":23,"app":"Archivos","comp":"Dropbox Business","plan":"Standard","precio":15,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"5 TB compartidos","fuente":"costbench.com/software/document-management/dropbox-business","conf":"Verificado"},{"row":24,"app":"Archivos","comp":"Dropbox Business","plan":"Advanced","precio":24,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Almacenamiento ilimitado","fuente":"costbench.com/software/document-management/dropbox-business","conf":"Verificado"},{"row":25,"app":"Archivos","comp":"Egnyte","plan":"Business","precio":22,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"egnyte.com/pricing","conf":"Verificado"},{"row":26,"app":"Archivos","comp":"Box","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 25 con pago mensual","fuente":"bestcloudstorageguide.com/blog/box-pricing","conf":"Verificado"},{"row":27,"app":"Conocimiento","comp":"Confluence","plan":"Standard","precio":5.42,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"docsie.io/blog/articles/confluence-vs-document360-pricing-comparison-2026","conf":"Verificado"},{"row":28,"app":"Conocimiento","comp":"Guru","plan":"All-in-one","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 10 asientos","fuente":"usecarly.com/blog/guru-alternatives","conf":"Verificado"},{"row":29,"app":"Conocimiento","comp":"Slite","plan":"Standard","precio":8,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"slite.com/learn/knowledge-base-softwares","conf":"Verificado"},{"row":30,"app":"Conocimiento","comp":"Notion","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Incluye Enterprise Search","fuente":"notion.com/pricing","conf":"Verificado"},{"row":31,"app":"Conocimiento","comp":"Document360","plan":"Professional","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"Rango 199-499 según uso de IA","fuente":"docsie.io/blog/articles/confluence-vs-document360-pricing-comparison-2026","conf":"Verificado"},{"row":32,"app":"Equipos","comp":"Slack","plan":"Pro","precio":7.25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"costbench.com/software/communication/slack","conf":"Verificado"},{"row":33,"app":"Equipos","comp":"Slack","plan":"Business+","precio":12.5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"costbench.com/software/communication/slack","conf":"Verificado"},{"row":34,"app":"Equipos","comp":"Microsoft Teams","plan":"Essentials","precio":4,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Sube a USD 4,50 en jul-2026","fuente":"getpricepulse.com/companies/slack-vs-microsoft-teams-pricing","conf":"Verificado"},{"row":35,"app":"Equipos","comp":"Microsoft 365","plan":"Business Basic","precio":6,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Teams + Office web","fuente":"getpricepulse.com/companies/slack-vs-microsoft-teams-pricing","conf":"Verificado"},{"row":36,"app":"Equipos","comp":"Microsoft 365","plan":"Business Standard","precio":12.5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Incluye Office escritorio","fuente":"getpricepulse.com/companies/slack-vs-microsoft-teams-pricing","conf":"Verificado"},{"row":37,"app":"Kanban","comp":"Trello","plan":"Standard","precio":5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"costbench.com/software/project-management/trello","conf":"Verificado"},{"row":38,"app":"Kanban","comp":"Trello","plan":"Premium","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"costbench.com/software/project-management/trello","conf":"Verificado"},{"row":39,"app":"Kanban","comp":"Trello","plan":"Enterprise","precio":17.5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 50 asientos","fuente":"costbench.com/software/project-management/trello","conf":"Verificado"},{"row":40,"app":"Kanban","comp":"ClickUp","plan":"Unlimited","precio":7,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"layer3labs.io/guides/clickup-pricing","conf":"Verificado"},{"row":41,"app":"Kanban","comp":"ClickUp","plan":"Business","precio":12,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"layer3labs.io/guides/clickup-pricing","conf":"Verificado"},{"row":42,"app":"Kanban","comp":"ClickUp","plan":"Business Plus","precio":19,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"layer3labs.io/guides/clickup-pricing","conf":"Verificado"},{"row":43,"app":"Kanban","comp":"Monday.com","plan":"Basic","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 3 asientos","fuente":"softwarefinder.com/resources/trello-vs-asana-vs-monday-vs-clickup","conf":"Verificado"},{"row":44,"app":"Kanban","comp":"Asana","plan":"Starter","precio":13.49,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"softwarefinder.com/resources/trello-vs-asana-vs-monday-vs-clickup","conf":"Verificado"},{"row":45,"app":"Kanban","comp":"Asana","plan":"Advanced","precio":24.99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Se factura en bloques de 5","fuente":"plutio.com/compare/asana-vs-wrike","conf":"Verificado"},{"row":46,"app":"Planificación (Gantt)","comp":"Smartsheet","plan":"Pro","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tech.co/project-management-software/smartsheet-pricing","conf":"Verificado"},{"row":47,"app":"Planificación (Gantt)","comp":"Smartsheet","plan":"Business","precio":19,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"tech.co/project-management-software/smartsheet-pricing","conf":"Verificado"},{"row":48,"app":"Planificación (Gantt)","comp":"Wrike","plan":"Team","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"2 a 15 usuarios","fuente":"costbench.com/software/project-management/wrike","conf":"Verificado"},{"row":49,"app":"Planificación (Gantt)","comp":"Wrike","plan":"Business","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 5 asientos","fuente":"costbench.com/software/project-management/wrike","conf":"Verificado"},{"row":50,"app":"Planificación (Gantt)","comp":"Microsoft Project","plan":"Plan 1","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"techrepublic.com/article/microsoft-project-vs-smartsheet","conf":"Verificado"},{"row":51,"app":"Planificación (Gantt)","comp":"Microsoft Project","plan":"Plan 3","precio":30,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Tier real para gestión de recursos","fuente":"techrepublic.com/article/microsoft-project-vs-smartsheet","conf":"Verificado"},{"row":52,"app":"Planificación (Gantt)","comp":"Instagantt","plan":"Team","precio":20,"unidad":"Plano","seg":"PyME / Empresa","nota":"USD 240/ano, 3 colaboradores incluidos","fuente":"wrike.com/blog/best-gantt-chart-software-online","conf":"Verificado"},{"row":53,"app":"Planificación (Gantt)","comp":"TeamGantt","plan":"Lite","precio":19,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/teamgantt-vs-wrike","conf":"Verificado"},{"row":54,"app":"Notas de Equipo","comp":"Notion","plan":"Plus","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"notion.com/pricing","conf":"Verificado"},{"row":55,"app":"Notas de Equipo","comp":"Notion","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"notion.com/pricing","conf":"Verificado"},{"row":56,"app":"Notas de Equipo","comp":"Coda","plan":"Pro","precio":12,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Solo Doc Makers pagan","fuente":"vendr.com/marketplace/coda","conf":"Verificado"},{"row":57,"app":"Notas de Equipo","comp":"Coda","plan":"Team","precio":36,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"vendr.com/marketplace/coda","conf":"Verificado"},{"row":58,"app":"Notas de Equipo","comp":"Slite","plan":"Standard","precio":8,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"slite.com/learn/knowledge-base-softwares","conf":"Verificado"},{"row":59,"app":"HTML Panel / Dashboards","comp":"Retool","plan":"Team","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Más USD 5 por usuario interno","fuente":"jetadmin.io/blog/retool-pricing-explained-2026","conf":"Verificado"},{"row":60,"app":"HTML Panel / Dashboards","comp":"Retool","plan":"Business","precio":50,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Más USD 15 por usuario interno","fuente":"jetadmin.io/blog/retool-pricing-explained-2026","conf":"Verificado"},{"row":61,"app":"HTML Panel / Dashboards","comp":"Power BI","plan":"Pro","precio":14,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"toucantoco.com/en/blog/power-bi-pricing","conf":"Verificado"},{"row":62,"app":"HTML Panel / Dashboards","comp":"Power BI","plan":"Premium por usuario","precio":24,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"toucantoco.com/en/blog/power-bi-pricing","conf":"Verificado"},{"row":63,"app":"HTML Panel / Dashboards","comp":"Tableau","plan":"Viewer","precio":15,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"costbench.com/software/business-intelligence/tableau","conf":"Verificado"},{"row":64,"app":"HTML Panel / Dashboards","comp":"Tableau","plan":"Creator","precio":75,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"costbench.com/software/business-intelligence/tableau","conf":"Verificado"},{"row":65,"app":"HTML Panel / Dashboards","comp":"Geckoboard","plan":"Essential","precio":29,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"itqlick.com/geckoboard/pricing","conf":"Verificado"},{"row":66,"app":"FossFLOW (BPM)","comp":"Pipefy","plan":"Business","precio":18,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Free hasta 10 usuarios y 5 procesos","fuente":"aiproductivity.ai/blog/cflow-vs-kissflow-vs-pipefy","conf":"Verificado"},{"row":67,"app":"FossFLOW (BPM)","comp":"Kissflow","plan":"Por usuario","precio":9.9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"checkthat.ai/brands/kissflow/pricing","conf":"Verificado"},{"row":68,"app":"FossFLOW (BPM)","comp":"Process Street","plan":"Startup","precio":100,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"process.st/pricing","conf":"Estimado"},{"row":69,"app":"FossFLOW (BPM)","comp":"monday.com","plan":"Basic","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Usado como plataforma de workflow","fuente":"moxo.com/blog/best-business-process-management-software","conf":"Verificado"},{"row":70,"app":"FossFLOW (BPM)","comp":"Kissflow","plan":"Basic (plataforma)","precio":2500,"unidad":"Plano","seg":"Enterprise","nota":"Subió desde USD 1.500 en 2025","fuente":"checkthat.ai/brands/kissflow/pricing","conf":"Verificado"},{"row":71,"app":"FossFLOW (BPM)","comp":"Nintex","plan":"Standard","precio":1405,"unidad":"Plano","seg":"Enterprise","nota":"","fuente":"spotsaas.com/compare/kissflow-vs-nintex","conf":"Verificado"},{"row":72,"app":"Digitai (automatización IA)","comp":"Dify","plan":"Professional","precio":59,"unidad":"Plano","seg":"PyME / Empresa","nota":"5.000 créditos de mensajes","fuente":"checkthat.ai/brands/dify/pricing","conf":"Verificado"},{"row":73,"app":"Digitai (automatización IA)","comp":"Dify","plan":"Team","precio":159,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 créditos","fuente":"checkthat.ai/brands/dify/pricing","conf":"Verificado"},{"row":74,"app":"Digitai (automatización IA)","comp":"Flowise","plan":"Starter","precio":35,"unidad":"Plano","seg":"PyME / Empresa","nota":"Open source, self-host gratis","fuente":"opentools.ai/tools/flowiseai","conf":"Verificado"},{"row":75,"app":"Digitai (automatización IA)","comp":"Flowise","plan":"Enterprise","precio":65,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"opentools.ai/tools/flowiseai","conf":"Verificado"},{"row":76,"app":"Digitai (automatización IA)","comp":"n8n","plan":"Starter","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"Self-host gratis","fuente":"lindy.ai/blog/n8n-pricing","conf":"Verificado"},{"row":77,"app":"Digitai (automatización IA)","comp":"Relevance AI","plan":"Team","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"relevanceai.com/pricing","conf":"Estimado"},{"row":78,"app":"Formularios de Contacto","comp":"Typeform","plan":"Basic","precio":29,"unidad":"Plano","seg":"PyME / Empresa","nota":"100 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":79,"app":"Formularios de Contacto","comp":"Typeform","plan":"Plus","precio":59,"unidad":"Plano","seg":"PyME / Empresa","nota":"1.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":80,"app":"Formularios de Contacto","comp":"Typeform","plan":"Business","precio":99,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":81,"app":"Formularios de Contacto","comp":"Jotform","plan":"Bronze","precio":24.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"1.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":82,"app":"Formularios de Contacto","comp":"Jotform","plan":"Gold","precio":129,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":83,"app":"Formularios de Contacto","comp":"Tally","plan":"Pro","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual; free con respuestas ilimitadas","fuente":"formmate.app/blog/typeform-vs-tally","conf":"Verificado"},{"row":84,"app":"Formularios de Contacto","comp":"Fillout","plan":"Pro","precio":40,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"customjs.space/blog/best-form-builders-automation-2026","conf":"Verificado"},{"row":85,"app":"Formularios de Contacto","comp":"Fillout","plan":"Business","precio":75,"unidad":"Plano","seg":"PyME / Empresa","nota":"Respuestas ilimitadas","fuente":"customjs.space/blog/best-form-builders-automation-2026","conf":"Verificado"},{"row":86,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Lite","precio":14,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":87,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Growth","precio":39,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":88,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Premium","precio":59,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":89,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Ultimate","precio":79,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":90,"app":"Prospección Comercial","comp":"HubSpot Sales Hub","plan":"Starter","precio":15,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 20 con pago mensual","fuente":"docket.io/resources/research/hubspot-sales-hub-pricing","conf":"Verificado"},{"row":91,"app":"Prospección Comercial","comp":"HubSpot Sales Hub","plan":"Professional","precio":90,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Más USD 1.500 de onboarding","fuente":"docket.io/resources/research/hubspot-sales-hub-pricing","conf":"Verificado"},{"row":92,"app":"Prospección Comercial","comp":"Apollo.io","plan":"Basic","precio":49,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"salesmotion.io/blog/apollo-pricing","conf":"Verificado"},{"row":93,"app":"Prospección Comercial","comp":"Apollo.io","plan":"Organization","precio":119,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"salesmotion.io/blog/apollo-pricing","conf":"Verificado"},{"row":94,"app":"Prospección Comercial","comp":"Lusha","plan":"Starter","precio":37.45,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"cognism.com/blog/apollo-io-pricing","conf":"Verificado"},{"row":95,"app":"Prospección Comercial","comp":"Salesforce","plan":"Starter Suite","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"salesforce.com/sales/pricing","conf":"Verificado"},{"row":96,"app":"Prospección Comercial","comp":"Salesforce","plan":"Pro Suite","precio":100,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"salesforce.com/sales/pricing","conf":"Verificado"},{"row":97,"app":"Prospección Comercial","comp":"Salesforce","plan":"Enterprise","precio":175,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Subió 6% en ago-2025","fuente":"salesforce.com/sales/pricing","conf":"Verificado"},{"row":98,"app":"Social Planner","comp":"Buffer","plan":"Essentials","precio":5,"unidad":"Por canal","seg":"PyME / Empresa","nota":"Pago anual","fuente":"buffer.com/pricing","conf":"Verificado"},{"row":99,"app":"Social Planner","comp":"Buffer","plan":"Team","precio":10,"unidad":"Por canal","seg":"PyME / Empresa","nota":"Pago anual","fuente":"buffer.com/pricing","conf":"Verificado"},{"row":100,"app":"Social Planner","comp":"Hootsuite","plan":"Standard","precio":99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"superdirector.app/compare/sprout-social-vs-hootsuite-vs-later","conf":"Verificado"},{"row":101,"app":"Social Planner","comp":"Hootsuite","plan":"Advanced","precio":249,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Rango 199-399","fuente":"superdirector.app/compare/sprout-social-vs-hootsuite-vs-later","conf":"Verificado"},{"row":102,"app":"Social Planner","comp":"Metricool","plan":"Starter","precio":18,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual; USD 22 mensual","fuente":"checkthat.ai/brands/metricool/pricing","conf":"Verificado"},{"row":103,"app":"Social Planner","comp":"Later","plan":"Starter","precio":18.75,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"later.com/blog/social-media-scheduling-tools","conf":"Verificado"},{"row":104,"app":"Social Planner","comp":"Sprout Social","plan":"Advanced","precio":249,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"planifyapps.com/compare/metricool-vs-sprout-social","conf":"Verificado"},{"row":105,"app":"Kreative Studio","comp":"Canva","plan":"Teams","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual, mínimo 3 asientos; USD 20 mensual","fuente":"canvapricing.com","conf":"Verificado"},{"row":106,"app":"Kreative Studio","comp":"Adobe Express","plan":"Teams","precio":7.99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 4,99 el primer año","fuente":"insidepro360.com/en/saas-tools/canva-vs-adobe-express-vs-figma","conf":"Verificado"},{"row":107,"app":"Kreative Studio","comp":"Figma","plan":"Professional","precio":12,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Rango 12-60 según tipo de asiento","fuente":"match-vs.com/en/blog/best-design-tools","conf":"Verificado"},{"row":108,"app":"Kreative Studio","comp":"VistaCreate","plan":"Pro","precio":13,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"create.vista.com/pricing","conf":"Estimado"},{"row":109,"app":"Kimos FunPlai (gamificación)","comp":"Kahoot!","plan":"Paid","precio":29,"unidad":"Plano","seg":"PyME / Empresa","nota":"Desde USD 10; free hasta 25 asistentes","fuente":"saasworthy.com/product/kahoot/pricing","conf":"Verificado"},{"row":110,"app":"Kimos FunPlai (gamificación)","comp":"Spinify","plan":"Essentials","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/155500/Spinify","conf":"Verificado"},{"row":111,"app":"Kimos FunPlai (gamificación)","comp":"Spinify","plan":"Plus","precio":40,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/155500/Spinify","conf":"Verificado"},{"row":112,"app":"Kimos FunPlai (gamificación)","comp":"TalentLMS","plan":"Core","precio":119,"unidad":"Plano","seg":"PyME / Empresa","nota":"Insignias, puntos y rankings","fuente":"coursebox.ai/blog/gamified-learning-platforms","conf":"Verificado"},{"row":113,"app":"Kimos FunPlai (gamificación)","comp":"Mentimeter","plan":"Pro","precio":24.99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"mentimeter.com/plans","conf":"Estimado"},{"row":114,"app":"Kimos FunPlai (gamificación)","comp":"Gametize","plan":"Business","precio":50,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/186453/Gametize","conf":"Estimado"},{"row":115,"app":"ProductLab","comp":"Productboard","plan":"Essentials","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Por maker","fuente":"blog.buildbetter.ai/best-ai-product-roadmap-tools","conf":"Verificado"},{"row":116,"app":"ProductLab","comp":"Productboard","plan":"Pro","precio":80,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Por maker","fuente":"blog.buildbetter.ai/best-ai-product-roadmap-tools","conf":"Verificado"},{"row":117,"app":"ProductLab","comp":"Aha!","plan":"Discovery","precio":39,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"productlift.dev/blog/aha-pricing","conf":"Verificado"},{"row":118,"app":"ProductLab","comp":"Aha!","plan":"Roadmaps","precio":59,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"productlift.dev/blog/aha-pricing","conf":"Verificado"},{"row":119,"app":"ProductLab","comp":"Airfocus","plan":"Essential","precio":19,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"ideaplan.io/alternatives/airfocus","conf":"Verificado"},{"row":120,"app":"ProductLab","comp":"Airfocus","plan":"Advanced","precio":69,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"ideaplan.io/alternatives/airfocus","conf":"Verificado"},{"row":121,"app":"ProductLab","comp":"Jira Product Discovery","plan":"Standard","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Solo creadores facturan","fuente":"featurebase.app/blog/jira-product-discovery-pricing","conf":"Verificado"},{"row":122,"app":"Productos (PIM)","comp":"Plytix","plan":"Pro","precio":499,"unidad":"Plano","seg":"PyME / Empresa","nota":"50.000 SKU, asientos ilimitados","fuente":"plytix.com/pricing","conf":"Verificado"},{"row":123,"app":"Productos (PIM)","comp":"Plytix","plan":"Brand Portals add-on","precio":300,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"plytix.com/pricing","conf":"Verificado"},{"row":124,"app":"Productos (PIM)","comp":"Sales Layer","plan":"Business","precio":1000,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"saleslayer.com/pricing","conf":"Estimado"},{"row":125,"app":"Productos (PIM)","comp":"Akeneo","plan":"Growth SaaS","precio":3750,"unidad":"Plano","seg":"Enterprise","nota":"USD 45.000/ano","fuente":"piminto.com/blog/akeneo-pricing","conf":"Verificado"},{"row":126,"app":"Productos (PIM)","comp":"Salsify","plan":"Enterprise","precio":6250,"unidad":"Plano","seg":"Enterprise","nota":"USD 75.000/ano piso","fuente":"pimworks.io/blog/salsify-vs-akeneo","conf":"Verificado"},{"row":127,"app":"Tienda (e-commerce)","comp":"Shopify","plan":"Basic","precio":39,"unidad":"Plano","seg":"PyME / Empresa","nota":"Más comisiones de pago","fuente":"shopify.com/pricing","conf":"Verificado"},{"row":128,"app":"Tienda (e-commerce)","comp":"Shopify","plan":"Grow","precio":105,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"shopify.com/pricing","conf":"Verificado"},{"row":129,"app":"Tienda (e-commerce)","comp":"Shopify","plan":"Advanced","precio":399,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"shopify.com/pricing","conf":"Verificado"},{"row":130,"app":"Tienda (e-commerce)","comp":"BigCommerce","plan":"Standard","precio":39,"unidad":"Plano","seg":"PyME / Empresa","nota":"Tope por volumen de ventas anual","fuente":"getathenic.com/blog/best-ecommerce-platform-comparison-2026","conf":"Verificado"},{"row":131,"app":"Tienda (e-commerce)","comp":"BigCommerce","plan":"Plus","precio":105,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"getathenic.com/blog/best-ecommerce-platform-comparison-2026","conf":"Verificado"},{"row":132,"app":"Tienda (e-commerce)","comp":"Wix","plan":"Core","precio":17,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"websitebuilderexpert.com/ecommerce-website-builders/comparisons/wix-vs-shopify","conf":"Verificado"},{"row":133,"app":"Tienda (e-commerce)","comp":"Wix","plan":"Business Elite","precio":159,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"websitebuilderexpert.com/ecommerce-website-builders/comparisons/wix-vs-shopify","conf":"Verificado"},{"row":134,"app":"Vitrina (catálogo digital)","comp":"Linktree","plan":"Pro","precio":9,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"linktr.ee/pricing","conf":"Estimado"},{"row":135,"app":"Vitrina (catálogo digital)","comp":"Linktree","plan":"Premium","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"linktr.ee/pricing","conf":"Estimado"},{"row":136,"app":"Vitrina (catálogo digital)","comp":"Flipsnack","plan":"Starter","precio":14,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"flipsnack.com/pricing","conf":"Estimado"},{"row":137,"app":"Vitrina (catálogo digital)","comp":"Flipsnack","plan":"Professional","precio":35,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"flipsnack.com/pricing","conf":"Estimado"},{"row":138,"app":"Vitrina (catálogo digital)","comp":"Plytix","plan":"Brand Portals","precio":300,"unidad":"Plano","seg":"PyME / Empresa","nota":"Add-on sobre plan PIM","fuente":"plytix.com/pricing","conf":"Verificado"},{"row":139,"app":"KIMOS Cashflow","comp":"Float","plan":"Essential","precio":49,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/agicap-vs-moneto-vs-floatapp","conf":"Verificado"},{"row":140,"app":"KIMOS Cashflow","comp":"Float","plan":"Standard","precio":99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/agicap-vs-moneto-vs-floatapp","conf":"Verificado"},{"row":141,"app":"KIMOS Cashflow","comp":"Float","plan":"Premium","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/agicap-vs-moneto-vs-floatapp","conf":"Verificado"},{"row":142,"app":"KIMOS Cashflow","comp":"Fathom","plan":"Starter","precio":50,"unidad":"Plano","seg":"PyME / Empresa","nota":"Por módulo","fuente":"capterra.com/p/136476/Fathom","conf":"Verificado"},{"row":143,"app":"KIMOS Cashflow","comp":"Fathom","plan":"Silver","precio":260,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/136476/Fathom","conf":"Verificado"},{"row":144,"app":"KIMOS Cashflow","comp":"Agicap","plan":"Business","precio":180,"unidad":"Plano","seg":"PyME / Empresa","nota":"Precio bajo cotización, no publicado","fuente":"g2.com/products/agicap/pricing","conf":"Estimado"},{"row":145,"app":"Gestión de Eventos","comp":"Luma","plan":"Plus","precio":59,"unidad":"Plano","seg":"PyME / Empresa","nota":"0% comisión; free con 5%","fuente":"spotsaas.com/compare/luma-vs-eventbrite","conf":"Verificado"},{"row":146,"app":"Gestión de Eventos","comp":"Eventbrite","plan":"Pro","precio":15,"unidad":"Plano","seg":"PyME / Empresa","nota":"Más 3,7% + USD 1,79 por ticket","fuente":"stackscored.com/pricing/event-management","conf":"Verificado"},{"row":147,"app":"Gestión de Eventos","comp":"Dryfta","plan":"Basic","precio":99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"dryfta.com/pricing","conf":"Estimado"},{"row":148,"app":"Gestión de Eventos","comp":"Bizzabo","plan":"Event Experience OS","precio":499,"unidad":"Por usuario","seg":"Enterprise","nota":"Mínimo 3 usuarios = USD 17.999/ano","fuente":"stackscored.com/pricing/event-management","conf":"Verificado"},{"row":149,"app":"Gestión de Eventos","comp":"Cvent","plan":"Enterprise","precio":4167,"unidad":"Plano","seg":"Enterprise","nota":"USD 50.000/ano piso estimado","fuente":"stackscored.com/pricing/event-management","conf":"Estimado"},{"row":150,"app":"Integraciones","comp":"Zapier","plan":"Professional","precio":19.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":151,"app":"Integraciones","comp":"Zapier","plan":"Team","precio":69,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":152,"app":"Integraciones","comp":"Make","plan":"Core","precio":9,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 operaciones","fuente":"automationatlas.io/guides/zapier-vs-make-n8n-comparison","conf":"Verificado"},{"row":153,"app":"Integraciones","comp":"n8n","plan":"Starter","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"lindy.ai/blog/n8n-pricing","conf":"Verificado"},{"row":154,"app":"Estudio de Mercado","comp":"Crayon","plan":"Plataforma de inteligencia competitiva","precio":2500,"unidad":"Plano","seg":"Enterprise","nota":"Sin tarifa pública: contratos reportados de USD 25.000 a 40.000 al año, aquí ~USD 30.000/año dividido en doce","fuente":"clientcues.com/company/blog/posts/crayon-pricing-is-it-worth-30k-per-year","conf":"Estimado"},{"row":155,"app":"Estudio de Mercado","comp":"Klue","plan":"Competitive Enablement","precio":1667,"unidad":"Plano","seg":"Enterprise","nota":"Sin tarifa pública: despliegues de entrada desde USD 15.000-20.000 al año para equipos de 5 a 15 personas","fuente":"parano.ai/blog/klue-pricing","conf":"Estimado"},{"row":156,"app":"Estudio de Mercado","comp":"AlphaSense","plan":"Enterprise (por asiento)","precio":1250,"unidad":"Plano","seg":"Enterprise","nota":"USD 10.000-20.000 por asiento al año; se toma un asiento como referencia para no multiplicar por la dotación","fuente":"vendr.com/marketplace/alphasense","conf":"Estimado"},{"row":157,"app":"Estudio de Mercado","comp":"Contify","plan":"M&CI Platform","precio":1875,"unidad":"Plano","seg":"Enterprise","nota":"Rango reportado de USD 15.000 a 30.000 al año segun entidades vigiladas y asientos","fuente":"elevatedsignal.com/compare/contify/","conf":"Estimado"},{"row":158,"app":"Estudio de Mercado","comp":"Kompyte (Semrush)","plan":"Competitive Intelligence","precio":800,"unidad":"Plano","seg":"Enterprise","nota":"Se cotiza por Semrush; desde ~USD 800/mes, ~USD 20.000/año en el paquete Semrush Enterprise","fuente":"parano.ai/blog/kompyte-pricing","conf":"Estimado"},{"row":159,"app":"Estudio de Mercado","comp":"Attest","plan":"Professional","precio":2000,"unidad":"Plano","seg":"Enterprise","nota":"Investigación primaria: incluye el panel de encuestados, sin recargo por audiencia específica","fuente":"capterra.com/p/185458/Attest/","conf":"Estimado"},{"row":160,"app":"Estudio de Mercado","comp":"Statista","plan":"Professional Account","precio":1399,"unidad":"Plano","seg":"PyME / Empresa","nota":"Hasta 5 usuarios, contrato anual (USD 16.788/año), incluye Premium Statistics, Reports y Market Insights","fuente":"vendr.com/marketplace/statista","conf":"Verificado"},{"row":161,"app":"Estudio de Mercado","comp":"Semrush","plan":"Business","precio":499.95,"unidad":"Plano","seg":"PyME / Empresa","nota":"Incluye 5 asientos, asiento extra USD 100/mes; el complemento .Trends (Traffic Analytics y Market Explorer) cuesta aparte por usuario","fuente":"demandsage.com/semrush-pricing/","conf":"Verificado"},{"row":162,"app":"Estudio de Mercado","comp":"Similarweb","plan":"Web Intelligence Starter","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"USD 125/mes con pago anual (USD 1.500/año); Sales Intelligence y App Intelligence se cobran aparte","fuente":"saaspricepulse.com/tools/similarweb","conf":"Verificado"},{"row":163,"app":"Estudio de Mercado","comp":"Similarweb","plan":"Professional","precio":399,"unidad":"Plano","seg":"PyME / Empresa","nota":"USD 333/mes con pago anual; el pago mes a mes carga entre 20% y 25% sobre la tarifa anual","fuente":"saasodds.com/blog/similarweb-pricing","conf":"Verificado"},{"row":164,"app":"Estudio de Mercado","comp":"IBISWorld","plan":"Membresía anual","precio":333,"unidad":"Plano","seg":"PyME / Empresa","nota":"Membresía a medida desde ~USD 4.000/año; el informe sectorial suelto cuesta USD 2.850","fuente":"vantainsights.com/insights/ibisworld-vs-vantainsights","conf":"Estimado"},{"row":165,"app":"Estudio de Mercado","comp":"Prisync","plan":"Premium","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"Vigilancia de precios de la competencia sobre 1.000 productos; la API suma USD 39,80/mes","fuente":"pricinghunter.com/resources/prisync-pricing","conf":"Verificado"},{"row":166,"app":"Estudio de Mercado","comp":"Visualping","plan":"Business","precio":100,"unidad":"Plano","seg":"PyME / Empresa","nota":"Monitoreo de cambios en sitios de la competencia: 500 páginas, chequeos cada 5 minutos, API e integraciones","fuente":"visualping.io/blog/visualping-pricing-explained","conf":"Verificado"},{"row":167,"app":"Estudio de Mercado","comp":"SpyFu","plan":"Professional","precio":79,"unidad":"Plano","seg":"PyME / Empresa","nota":"Plan Basic USD 39/mes; pago anual descuenta 25%","fuente":"saaspricepulse.com/tools/spyfu","conf":"Verificado"},{"row":168,"app":"Estudio de Mercado","comp":"Owler","plan":"Pro","precio":39,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Facturado anual (USD 468 por usuario al año); seguimiento ilimitado de empresas y competidores","fuente":"uplead.com/owler-pricing/","conf":"Verificado"},{"row":169,"app":"Estudio de Mercado","comp":"SurveyMonkey","plan":"Team Advantage","precio":30,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 3 usuarios y facturación anual: la investigación primaria hecha por cuenta propia","fuente":"usercall.co/post/surveymonkey-pricing","conf":"Verificado"}],"planes":[{"id":"core","nombre":"Core","para":"Empresas que entran a probar la suite","incluye":"Plataforma base: escritorio con agentes, archivos, notas, equipos, conocimiento e integraciones","mods":[1,4,9,6,5,24],"desc":0.55},{"id":"starter","nombre":"Starter","para":"PyMEs de 5 a 20 personas sin procesos formales","incluye":"Core + gestión de tareas + captura de leads","mods":[1,4,9,6,5,24,7,13],"desc":0.55},{"id":"business","nombre":"Business","para":"Empresas de 20 a 100 personas con equipo comercial","incluye":"Core + proyectos + CRM + marketing + dashboards + agentes IA","mods":[1,4,9,6,5,24,7,13,8,14,15,16,10,2],"desc":0.6},{"id":"enterprise","nombre":"Enterprise","para":"Empresas de 100+ personas o con procesos regulados","incluye":"Todos los módulos, incluidos BPM, PIM, Tienda, Cashflow, ProductLab, Eventos y Agentes Web","mods":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],"desc":0.62}],"kits":[{"id":"comercial","nombre":"Kit Comercial","para":"Equipos de ventas y marketing","incluye":"Captar, atender y cerrar: CRM + formularios + chatbot + redes + diseño","mods":[14,13,3,15,16],"desc":0.45},{"id":"operaciones","nombre":"Kit Operaciones","para":"PMOs, operaciones y consultoras","incluye":"Ejecutar y controlar: tareas + Gantt + procesos + paneles","mods":[7,8,11,10,9],"desc":0.45},{"id":"retail","nombre":"Kit Retail","para":"Retail, distribución y marcas","incluye":"Vender en línea: catálogo maestro + tienda + vitrina + bot + diseño","mods":[19,20,21,3,16],"desc":0.45},{"id":"ia","nombre":"Kit IA","para":"Equipos técnicos y de innovación","incluye":"Automatizar con IA: escritorio + agentes + pipelines de datos + bot + base de conocimiento","mods":[1,2,12,3,5],"desc":0.45},{"id":"finanzas","nombre":"Kit Finanzas y Gestión","para":"Gerencia financiera","incluye":"Controlar la plata: flujo de caja + paneles + planificación + documentos","mods":[22,10,8,4],"desc":0.45}],"stack":[{"necesidad":"Archivos, correo y videollamadas","herramienta":"Google Workspace","plan":"Business Standard","comp":21},{"necesidad":"Chat de equipo","herramienta":"Slack","plan":"Pro","comp":32},{"necesidad":"Tareas y proyectos","herramienta":"ClickUp","plan":"Business","comp":41},{"necesidad":"Planificación Gantt","herramienta":"Smartsheet","plan":"Pro","comp":46},{"necesidad":"Base de conocimiento","herramienta":"Confluence","plan":"Standard","comp":27},{"necesidad":"Notas colaborativas","herramienta":"Notion","plan":"Plus","comp":54},{"necesidad":"CRM y prospección","herramienta":"Pipedrive","plan":"Growth","comp":87},{"necesidad":"Redes sociales","herramienta":"Buffer","plan":"Team","comp":99},{"necesidad":"Formularios","herramienta":"Typeform","plan":"Basic","comp":78},{"necesidad":"Diseño gráfico","herramienta":"Canva","plan":"Teams","comp":105},{"necesidad":"Chatbot web","herramienta":"Tidio","plan":"Growth","comp":12},{"necesidad":"Flujo de caja","herramienta":"Float","plan":"Standard","comp":140},{"necesidad":"Dashboards","herramienta":"Power BI","plan":"Pro","comp":61},{"necesidad":"Automatización de procesos","herramienta":"Pipefy","plan":"Business","comp":66},{"necesidad":"Automatización IA","herramienta":"Dify","plan":"Professional","comp":72},{"necesidad":"Gamificación","herramienta":"Kahoot!","plan":"Paid","comp":109},{"necesidad":"Gestión de producto","herramienta":"Jira Product Discovery","plan":"Standard","comp":121},{"necesidad":"PIM / catálogo","herramienta":"Plytix","plan":"Pro","comp":122},{"necesidad":"Tienda online","herramienta":"Shopify","plan":"Grow","comp":128},{"necesidad":"Vitrina de marca","herramienta":"Linktree","plan":"Premium","comp":135},{"necesidad":"Asistente IA","herramienta":"ChatGPT Business","plan":"Business","comp":0},{"necesidad":"Agentes / automatización","herramienta":"Zapier","plan":"Team","comp":6},{"necesidad":"Integraciones","herramienta":"Make","plan":"Core","comp":152},{"necesidad":"Eventos","herramienta":"Luma","plan":"Plus","comp":145}],"demanda":{"params":{"saasGlobal":{"label":"Mercado SaaS global 2026","valor":375570,"unidad":"USD MM","nota":"Suma de las cinco regiones"},"gastoSuites":{"label":"Gasto en suites de gestión","valor":0.22,"unidad":"% del SaaS","nota":"Supuesto: participación de suites de gestión y productividad"},"pymeShare":{"label":"Participación PyME y mid-market","valor":0.45,"unidad":"% de la categoría","nota":"Supuesto"},"segmento":{"label":"Segmento 10-250 empleados","valor":0.55,"unidad":"% del segmento","nota":"Supuesto: rango que KIMOS puede atender"},"churn":{"label":"Churn mensual","valor":0.04,"unidad":"%","nota":"Benchmark PyME: 3% a 7%, mediana 3,5%"},"margen":{"label":"Margen bruto","valor":0.75,"unidad":"%","nota":"Castigado por el costo variable de IA"},"cac":{"label":"CAC promedio","valor":1200,"unidad":"USD","nota":"Benchmark PyME autoservicio: USD 200 a 700"},"clientes3":{"label":"Clientes captados al año 3","valor":550,"unidad":"clientes","nota":"Bruto acumulado, antes de churn"}},"regiones":[{"region":"Norteamérica","saas":172680,"share":0.46,"cagr":0.13,"cobertura":0.15,"indice":1,"lectura":"EE.UU. y Canadá. Mayor concentración de proveedores e infraestructura cloud madura. También donde están todos los competidores con capital ilimitado.","fuente":"fortunebusinessinsights.com/software-as-a-service-saas-market-102222","conf":"Verificado"},{"region":"Asia-Pacífico","saas":86060,"share":0.229,"cagr":0.22,"cobertura":0.1,"indice":0.7,"lectura":"Región de mayor crecimiento del mundo. Mayor varianza interna de precio: 40 puntos entre Japon/Australia y el sudeste asiático emergente.","fuente":"precedenceresearch.com/software-as-a-service-market","conf":"Verificado"},{"region":"Europa","saas":70810,"share":0.189,"cagr":0.12,"cobertura":0.2,"indice":0.95,"lectura":"Mercado maduro con alta exigencia de cumplimiento (GDPR, residencia de datos). Los nórdicos pagan 8-18% de premium sobre el baseline de EE.UU.","fuente":"fortunebusinessinsights.com/software-as-a-service-saas-market-102222","conf":"Verificado"},{"region":"América Latina","saas":21000,"share":0.056,"cagr":0.148,"cobertura":0.6,"indice":0.6,"lectura":"USD 21.000 MM en 2025, proyectado a USD 45.000 MM en 2030. Brasil concentra el 60% de las ~17.000 empresas SaaS de la región.","fuente":"informesdeexpertos.com/informes/mercado-latinoamericano-de-software-como-servicio-saas","conf":"Verificado"},{"region":"Medio Oriente y África","saas":25020,"share":0.066,"cagr":0.16,"cobertura":0.05,"indice":0.55,"lectura":"Residual del total global. Mercado incipiente, alta dependencia de proveedores globales.","fuente":"Calculo residual sobre el total global de USD 375.570 MM","conf":"Estimado"}],"paises":[{"pais":"Estados Unidos","region":"Norteamérica","idioma":"Inglés","prioridad":"Expansión","cobertura":0.2,"peso":0.7935,"publicado":141060,"indice":1,"empresas":36200000,"contexto":"USD 141.060 MM en 2026, el 37,5% del mercado mundial. 36,2 millones de pequeñas empresas, el 99,9% del total.","conf":"Verificado"},{"pais":"Canadá","region":"Norteamérica","idioma":"Inglés","prioridad":"Expansión","cobertura":0.2,"peso":0.2065,"publicado":36700,"indice":0.95,"empresas":null,"contexto":"USD 36.700 MM: el 16% del gasto SaaS norteamericano. Crece al 12,6% anual hasta 2030.","conf":"Verificado"},{"pais":"Alemania","region":"Europa","idioma":"Alemán","prioridad":"Oportunista","cobertura":0.08,"peso":0.2092,"publicado":14810,"indice":0.98,"empresas":3200000,"contexto":"El mayor mercado SaaS de Europa. 3,2 millones de empresas activas.","conf":"Verificado"},{"pais":"Francia","region":"Europa","idioma":"Francés","prioridad":"Oportunista","cobertura":0.08,"peso":0.1863,"publicado":13190,"indice":0.95,"empresas":5300000,"contexto":"5,3 millones de empresas activas, la mayor población empresarial de la UE.","conf":"Verificado"},{"pais":"Reino Unido","region":"Europa","idioma":"Inglés","prioridad":"Expansión","cobertura":0.2,"peso":0.1826,"publicado":12930,"indice":0.98,"empresas":null,"contexto":"Puerta de entrada natural a Europa por idioma y práctica comercial.","conf":"Verificado"},{"pais":"Italia","region":"Europa","idioma":"Italiano","prioridad":"Oportunista","cobertura":0.08,"peso":0.0833,"publicado":null,"indice":0.85,"empresas":4600000,"contexto":"4,6 millones de empresas activas. Mercado cloud de USD 14.300 MM en 2025 creciendo al 16,4%.","conf":"Estimado"},{"pais":"España","region":"Europa","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0621,"publicado":null,"indice":0.82,"empresas":3500000,"contexto":"3,5 millones de empresas activas. Mismo idioma: es el puente entre LATAM y Europa.","conf":"Estimado"},{"pais":"Nórdicos","region":"Europa","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.065,"publicado":null,"indice":1.05,"empresas":null,"contexto":"Suecia, Dinamarca, Noruega y Finlandia. Pagan entre 8% y 18% de premium sobre la lista de EE.UU.","conf":"Estimado"},{"pais":"Países Bajos","region":"Europa","idioma":"Neerlandés","prioridad":"Oportunista","cobertura":0.08,"peso":0.0466,"publicado":null,"indice":0.98,"empresas":null,"contexto":"Alta digitalización y operación comercial en inglés.","conf":"Estimado"},{"pais":"Polonia","region":"Europa","idioma":"Polaco","prioridad":"No perseguir","cobertura":0.01,"peso":0.0311,"publicado":null,"indice":0.62,"empresas":null,"contexto":"Crece rápido pero con menor poder adquisitivo y competencia local fuerte.","conf":"Estimado"},{"pais":"Resto de Europa","region":"Europa","idioma":"Varios","prioridad":"No perseguir","cobertura":0.01,"peso":0.1338,"publicado":null,"indice":0.75,"empresas":null,"contexto":"Agregado del resto del continente. Total de PyMEs en la UE: 34 millones.","conf":"Derivado"},{"pais":"China","region":"Asia-Pacífico","idioma":"Chino","prioridad":"No perseguir","cobertura":0.01,"peso":0.2259,"publicado":19440,"indice":0.55,"empresas":null,"contexto":"El mayor mercado de la región. Ecosistema cerrado y competencia local dominante.","conf":"Verificado"},{"pais":"India","region":"Asia-Pacífico","idioma":"Inglés","prioridad":"No perseguir","cobertura":0.01,"peso":0.2004,"publicado":17250,"indice":0.35,"empresas":null,"contexto":"Proyectado a USD 58.400 MM en 2033 creciendo al 16,9% anual: el de mayor crecimiento del mundo, y también el más sensible al precio.","conf":"Verificado"},{"pais":"Japón","region":"Asia-Pacífico","idioma":"Japonés","prioridad":"No perseguir","cobertura":0.01,"peso":0.1981,"publicado":17050,"indice":0.85,"empresas":3500000,"contexto":"3,5 millones de MiPymes, el 99,7% de las empresas. Exige localización profunda y ciclos largos.","conf":"Verificado"},{"pais":"Australia","region":"Asia-Pacífico","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.1604,"publicado":13800,"indice":0.98,"empresas":null,"contexto":"USD 13.800 MM estimados para 2026. El 2,6% del mercado mundial y el mercado más accesible de la región por idioma.","conf":"Verificado"},{"pais":"Corea del Sur","region":"Asia-Pacífico","idioma":"Coreano","prioridad":"No perseguir","cobertura":0.01,"peso":0.0755,"publicado":null,"indice":0.8,"empresas":null,"contexto":"Crece al 9,4% anual. Alta digitalización pero fuerte preferencia por proveedores locales.","conf":"Estimado"},{"pais":"Singapur","region":"Asia-Pacífico","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.0349,"publicado":null,"indice":0.95,"empresas":null,"contexto":"Pequeño pero de alto ticket y en inglés. Buena cabecera de playa regional.","conf":"Estimado"},{"pais":"Resto de Asia-Pacífico","region":"Asia-Pacífico","idioma":"Varios","prioridad":"No perseguir","cobertura":0.01,"peso":0.1048,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Sudeste asiático emergente. Hasta 40 puntos de precio por debajo de Japón y Australia.","conf":"Derivado"},{"pais":"Brasil","region":"América Latina","idioma":"Portugués","prioridad":"Expansión","cobertura":0.2,"peso":0.5513,"publicado":11578,"indice":0.55,"empresas":null,"contexto":"USD 9.216 MM en 2024 creciendo al 12,1% anual. Concentra el 60% de las ~17.000 empresas SaaS de la región.","conf":"Verificado"},{"pais":"México","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.17,"publicado":3570,"indice":0.6,"empresas":6000000,"contexto":"El 17% del mercado SaaS latinoamericano. 6 millones de unidades económicas; las pymes dan 7 de cada 10 empleos.","conf":"Verificado"},{"pais":"Argentina","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0619,"publicado":null,"indice":0.45,"empresas":null,"contexto":"Las pymes son el 99,4% de las empresas y emplean al 64% de los asalariados. El 41,6% ya usa alguna herramienta de IA.","conf":"Estimado"},{"pais":"Colombia","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0548,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Uno de los países más emprendedores de la región junto con México y Perú.","conf":"Estimado"},{"pais":"Chile","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0548,"publicado":null,"indice":0.62,"empresas":1194430,"contexto":"Mercado base de KIMOS. 1,19 millones de MiPymes formales y el mayor poder adquisitivo de la región.","conf":"Estimado"},{"pais":"Perú","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0286,"publicado":null,"indice":0.5,"empresas":2100000,"contexto":"Más de 2,1 millones de MiPymes formales.","conf":"Estimado"},{"pais":"Resto de América Latina","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0786,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Centroamérica, Caribe hispano, Ecuador, Uruguay, Bolivia y Paraguay.","conf":"Derivado"},{"pais":"Arabia Saudita","region":"Medio Oriente y África","idioma":"Árabe","prioridad":"No perseguir","cobertura":0.01,"peso":0.18,"publicado":null,"indice":0.85,"empresas":null,"contexto":"Fuerte inversión estatal en digitalización.","conf":"Estimado"},{"pais":"Emiratos Árabes Unidos","region":"Medio Oriente y África","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.16,"publicado":null,"indice":0.9,"empresas":null,"contexto":"Hub regional, alto poder adquisitivo y operación en inglés.","conf":"Estimado"},{"pais":"Israel","region":"Medio Oriente y África","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.12,"publicado":null,"indice":0.95,"empresas":null,"contexto":"Alta densidad tecnológica y también altísima competencia local.","conf":"Estimado"},{"pais":"Sudáfrica","region":"Medio Oriente y África","idioma":"Inglés","prioridad":"No perseguir","cobertura":0.01,"peso":0.1,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Principal mercado del África subsahariana.","conf":"Estimado"},{"pais":"Resto de Medio Oriente y África","region":"Medio Oriente y África","idioma":"Varios","prioridad":"No perseguir","cobertura":0.01,"peso":0.44,"publicado":null,"indice":0.4,"empresas":null,"contexto":"Agregado del resto de la región.","conf":"Derivado"}],"mixPlan":[{"plan":"Starter","peso":0.6},{"plan":"Business","peso":0.3},{"plan":"Enterprise","peso":0.1}],"mixRegion":[{"region":"América Latina","peso":0.55},{"region":"Europa","peso":0.18},{"region":"Norteamérica","peso":0.15},{"region":"Asia-Pacífico","peso":0.1},{"region":"Medio Oriente y África","peso":0.02}]},"evidencia":[{"titulo":"Universo de empresas","cols":["Ámbito","Métrica","Valor","Unidad","Contexto","Fuente","Confianza"],"filas":[["Global","Pequeñas empresas en el mundo","400.000.000","empresas","El 90% de las empresas operativas del mundo son PyMEs y emplean a más del 50% de la fuerza laboral global","hostinger.com/tutorials/small-business-statistics","Verificado"],["Estados Unidos","Pequeñas empresas","36.200.000","empresas","Representan el 99,9% de todas las compañías del país","demandsage.com/small-business-statistics","Verificado"],["Union Europea","PyMEs","24.000.000","empresas","Representan el 99,8% del tejido empresarial europeo. Cifra exacta tras muro de pago; orden de magnitud confirmado","europarl.europa.eu/factsheets/en/sheet/63/small-and-medium-sized-enterprises","Estimado"],["Norteamérica","Adopción de software PyME","40","% del global","Lidera la adopción mundial de software PyME por madurez de infraestructura","businessresearchinsights.com/market-reports/small-and-medium-business-smb-software-market-108773","Verificado"],["Chile","MiPymes formales","1.194.430","empresas","66% micro, 29% pequeñas, 5% medianas. Emplean a 6,4 millones de personas (~50% del empleo)","sii.cl/estadisticas/empresas_tamano_ventas.htm","Verificado"],["México","Unidades económicas","6.000.000","empresas","Las pymes generan 7 de cada 10 puestos de trabajo del país","konfio.mx/blog/panorama-pyme/datos-clave-del-crecimiento-empresarial-en-mexico","Verificado"],["Perú","MiPymes formales","2.100.000","empresas","Dato 2021, último consolidado disponible","ogeiee.produce.gob.pe/index.php/en/shortcode/estadistica-oee/estadisticas-mipyme","Verificado"],["Argentina","PyMEs sobre el total","99.4","% de empresas","Emplean al 64% de los asalariados registrados","infopymes.com.ar/pymes-como-esta-la-argentina-en-comparacion-con-latam","Verificado"]]},{"titulo":"Consumo de SaaS","cols":["Métrica","Valor","Unidad","Por que importa","Fuente","Confianza"],"filas":[["Apps SaaS por empresa (promedio)","106","apps","Bajo un 18% desde el pico de 130 en 2022. La consolidación ya empezó.","zylo.com/blog/saas-statistics","Verificado"],["Apps SaaS en empresa pequeña","87","apps","Es el número que KIMOS promete reducir","zylo.com/blog/saas-statistics","Verificado"],["Apps SaaS en mid-market","187","apps","Segmento con mayor dolor de fragmentación","zylo.com/blog/saas-statistics","Verificado"],["Apps SaaS en gran empresa","371","apps","5.000+ empleados","zylo.com/blog/saas-statistics","Verificado"],["Gasto SaaS por empleado/ano","10.800","USD","Proyección 2026. En empresas pequeñas el rango va de USD 8.000 a 15.000.","vendorbenchmark.com/blog/saas-spend-per-employee-benchmark-data","Verificado"],["Crecimiento del gasto SaaS","8","% interanual","El portafolio de apps se mantiene estable pero el gasto sube por precios e IA embebida","zylo.com/blog/saas-statistics","Verificado"],["Líderes tech que planean consolidar","68","%","La mayoría apunta a reducir un 20% el número de proveedores durante 2026. Es exactamente la tesis de KIMOS.","vantagepoint.io/blog/sf/insights/platform-consolidation-2026-saas-stack-reduction-ai","Verificado"]]},{"titulo":"Comportamiento de compra","cols":["Que mide","Dato","Que significa para KIMOS","Fuente","Confianza"],"filas":[["Tamaño del comité de compra PyME","3 a 5 personas","1-2 campeones, 1-2 decisores, 2-5 influenciadores y 1-3 bloqueadores. En 2014 eran 5,4 en promedio; hoy el promedio general supera los 11.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"],["Ciclo de venta bajo USD 15K","14 a 30 días","Entre USD 15K y 50K sube a 30-60 días. Cada participante adicional en el comité suma 8-22 días.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"],["Proceso completado sin hablar con ventas","69%","El comprador investiga, compara y decide solo. Si KIMOS no pública precios, queda fuera antes de la primera reunión.","martal.ca/b2b-buying-process-lb","Verificado"],["Compradores que llegan con requisitos definidos","83%","No vienen a que les expliquen la categoría: vienen a validar si cumples una lista.","martal.ca/b2b-buying-process-lb","Verificado"],["Procurement como decisor","53% de los ciclos","Participa desde el inicio, no al final. En deals PyME esto suele ser el dueño o el gerente de administración.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"],["Probabilidad de estancamiento por stakeholder","12 a 22% adicional","Argumento fuerte para vender kits departamentales en vez de la suite completa: menos firmas, menos riesgo de que el deal muera.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"]]},{"titulo":"Benchmarks de retención y adquisición","cols":["Métrica","Benchmark","Lectura","Fuente","Confianza"],"filas":[["Churn mensual PyME","3% a 7%","Mediana de 3,5% sobre 500+ empresas. El cuartil superior baja de 3%.","artisangrowthstrategies.com/blog/saas-churn-rate-benchmarks-2026-500-companies","Verificado"],["Churn en los primeros 90 días","40% a 60%","Del churn total. El negocio se gana en el onboarding, no en la venta.","saasfractionalcpo.com/blog/reduce-churn-in-saas-a-complete-guide","Verificado"],["Efecto de un onboarding estructurado","+25% de retención","En el primer año. Es la palanca de retención más barata que existe.","saasfractionalcpo.com/blog/reduce-churn-in-saas-a-complete-guide","Verificado"],["LTV:CAC en PyME","2,5:1","Funciona porque el costo de adquisición es bajo en términos absolutos, no porque el churn sea bueno.","optif.ai/learn/questions/b2b-saas-ltv-benchmark","Verificado"],["CAC en PyME","USD 200 a 700","Para venta autoservicio o inside sales ligera.","unbuiltlab.com/learn/benchmarks/saas-cac-benchmarks","Verificado"],["LTV en PyME","USD 15.000 a 40.000","Rango amplio según expansión de cuenta.","optif.ai/learn/questions/b2b-saas-ltv-benchmark","Verificado"],["Conversión free a pago","2% a 5%","Define cuanto tráfico hace falta para sostener el plan comercial.","foundrycro.com/blog/saas-marketing-benchmarks-2026","Verificado"],["CAC payback en PyME","6,2 meses","Herramientas PyME y prosumer. El objetivo general del sector es bajar de 12 meses.","foundrycro.com/blog/saas-marketing-benchmarks-2026","Verificado"]]},{"titulo":"Índice de precio por región","cols":["Región","Índice sobre EE.UU.","Nota","Fuente","Confianza"],"filas":[["Norteamérica","1","Línea base. KIMOS con factor 0,55 está dejando margen sobre la mesa en este mercado.","saasceo.com/localized-pricing","Verificado"],["Europa","0.95","Los nórdicos pagan 8-18% de premium sobre lista pero negocian 20-38% de descuento; el neto queda cerca del baseline.","vendorbenchmark.com/blog/software-pricing-regional-benchmark-global","Verificado"],["Asia-Pacífico","0.7","Promedio regional. Japón y Australia cerca del baseline; sudeste asiático hasta 40 puntos por debajo.","vendorbenchmark.com/blog/software-pricing-regional-benchmark-global","Verificado"],["América Latina","0.6","Los benchmarks locales están 40-60% bajo EE.UU. El 67% de los compradores prefiere igual el precio en USD.","saasceo.com/localized-pricing","Verificado"],["Medio Oriente y África","0.55","Menor poder adquisitivo y mayor fricción de pago.","geotargetly.com/blog/pricing-localization-saas","Estimado"]]},{"titulo":"Mercado de la inteligencia competitiva","cols":["Ámbito","Métrica","Valor","Unidad","Contexto","Fuente","Confianza"],"filas":[["Global","Mercado de herramientas de inteligencia competitiva","870.000.000","USD","Valor 2026 con proyección a USD 4.030 MM en 2034 (CAGR 21,2%) en la definición estrecha de la categoría","fortunebusinessinsights.com/competitive-intelligence-tools-market-104522","Verificado"],["Global","Mismo mercado en definición amplia","3.120.000.000","USD","Otra consultora ubica 2026 en USD 3.120 MM camino a USD 9.680 MM en 2033 (CAGR 17,5%). La horquilla entre 0,87 y 3,12 mil millones no es ruido: mide cuánto cambia el número según qué se cuente como inteligencia competitiva","openpr.com/news/4232959/competitive-intelligence-software-market-size-by-type","Estimado"],["Global","Informe sectorial suelto","2.850","USD","IBISWorld cobra USD 2.850 por informe y ~USD 4.000 al año por membresía: el estudio hecho a mano una sola vez cuesta más que la suscripción anual al modelo","vantainsights.com/insights/ibisworld-vs-vantainsights","Estimado"],["Global","Piso de entrada a una plataforma CI dedicada","15.000","USD/año","Klue y Crayon parten en cinco cifras anuales y ninguno publica tarifa: por precio, la categoría deja fuera a la PyME, que es exactamente el hueco que ocupa este módulo","parano.ai/blog/klue-pricing","Estimado"]]}],"icp":[{"perfil":"El dueño que perdió el control del gasto","rol":"Gerente General o socio fundador","tamano":"10 a 50 empleados","producto":"Starter o Business","dolor":"Tiene entre 8 y 12 suscripciones sueltas y nadie sabe cuánto suman. La información vive en cuatro herramientas que no se hablan.","gatillo":"Le llega la renovación anual de una suscripción cara, o un error de coordinación le costó un cliente.","objecion":"\"Ya pague por estas herramientas y mi equipo las sabe usar. Cambiar me va a costar más de lo que ahorro.\"","venta":"Con la cuenta del stack actual sobre la mesa. No se vende funcionalidad: se vende la factura consolidada y las horas que se pierden saltando entre pestañas."},{"perfil":"El comercial sin pipeline visible","rol":"Gerente Comercial o de Ventas","tamano":"20 a 100 empleados","producto":"Kit Comercial","dolor":"Los leads del formulario web se pierden antes de llegar al vendedor. No hay forma de saber qué pasó con cada oportunidad.","gatillo":"Cierre de trimestre bajo meta, o la contratación de vendedores nuevos que necesitan un proceso.","objecion":"\"Mi CRM actual funciona y migrar el historial de clientes me da pánico.\"","venta":"Mostrando el ciclo cerrado: formulario, chatbot, CRM y campaña en el mismo lugar. El argumento es la fuga de leads, no el precio del CRM."},{"perfil":"El jefe de operaciones que vive en planillas","rol":"Jefe de Operaciones o PMO","tamano":"30 a 150 empleados","producto":"Kit Operaciones o BPM","dolor":"Los procesos críticos están en Excel sin trazabilidad ni control de versiones. Cada auditoría es una crisis.","gatillo":"Una certificación, una auditoría fallida, o un crecimiento que rompió la planilla.","objecion":"\"Esto lo tiene que aprobar TI y ellos ya tienen su propio roadmap.\"","venta":"Con trazabilidad y cumplimiento. Aquí el competidor es Kissflow a USD 2.500/mes de plataforma: la brecha de precio hace la venta sola."},{"perfil":"El de e-commerce con el catálogo roto","rol":"Gerente de E-commerce o Retail","tamano":"500+ SKU, 20 a 200 empleados","producto":"Kit Retail","dolor":"El catálogo vive en tres lugares distintos y publicar en un canal nuevo toma semanas de trabajo manual.","gatillo":"Apertura de un marketplace nuevo, rebranding, o una temporada alta que expuso el desorden.","objecion":"\"Ya tengo Shopify y no pienso migrar mi tienda.\"","venta":"No pidiéndole que migre. KIMOS es el catálogo maestro que alimenta a Shopify: integración, no reemplazo."},{"perfil":"El financiero que proyecta a ciegas","rol":"Gerente de Administración y Finanzas","tamano":"20 a 100 empleados","producto":"Kit Finanzas y Gestión","dolor":"Proyecta la caja en una planilla que solo él entiende y se entera de los problemas cuando ya ocurrieron.","gatillo":"Un apretón de caja, la solicitud de una línea de crédito o la entrada de un inversionista.","objecion":"\"Mi contador ya me entrega reportes y esto suena a duplicar trabajo.\"","venta":"Con la diferencia entre mirar hacia atrás y proyectar hacia adelante. Requiere integración bancaria local: sin eso, no compra."},{"perfil":"El de TI con mandato de IA y sin equipo","rol":"CTO, Jefe de TI o de Innovación","tamano":"50 a 250 empleados","producto":"Kit IA o Enterprise","dolor":"Mantiene 15 integraciones frágiles y tiene presión del directorio por \"hacer algo con IA\" sin presupuesto para contratar.","gatillo":"Mandato del directorio sobre IA, o una integración que se cayó y paro la operación.","objecion":"\"Puedo armar esto con n8n autohospedado y me sale gratis.\"","venta":"Con costo total de propiedad: el software open source es gratis, mantenerlo no. Es el perfil más escéptico y el que más valida antes de comprar."}],"segmentos":[{"segmento":"Micro","empleados":"1 a 9","veredicto":"No perseguir","plan":"-","porque":"No sostienen un ticket de suscripción integral y su tasa de mortalidad empresarial es alta.","riesgo":"Churn destructivo: cancelan cuando su propio ingreso se contrae. Consumen soporte y no dejan margen."},{"segmento":"Pequeña","empleados":"10 a 49","veredicto":"Objetivo primario","plan":"Starter y Kits","porque":"Ya sienten el dolor de la fragmentación pero deciden rápido: comité de 3 personas y ciclo de 14 a 30 días.","riesgo":"Sensibles al precio y con bajo costo de cambio. Se retienen con onboarding, no con contrato."},{"segmento":"Mediana","empleados":"50 a 249","veredicto":"Objetivo de mayor valor","plan":"Business y Enterprise","porque":"Es donde vive el dolor de las 187 apps y donde el presupuesto de consolidación es real.","riesgo":"Ciclo más largo, exige integraciones y suele tener TI con opinión propia."},{"segmento":"Grande","empleados":"250+","veredicto":"Nicho selectivo","plan":"Enterprise + implementación","porque":"Ticket alto y contratos plurianuales, pero exige SSO, auditoría, SLA y cumplimiento.","riesgo":"Puede consumir todo el roadmap atendiendo a un solo cliente. Aceptar solo con implementación pagada."}],"decisiones":[{"n":1,"decision":"La tesis de consolidación tiene viento a favor, y es medible","oferta":"La suite completa cuesta 28% de lo que gasta hoy el cliente en herramientas sueltas: USD 777 contra USD 2.767 al mes.","demanda":"El 68% de los líderes tecnológicos planea reducir proveedores en 2026 y el promedio de apps por empresa ya cayó de 130 a 106.","hacer":"Poner el ahorro consolidado al centro del discurso comercial, con la calculadora del stack actual como primera pantalla del sitio.","impacto":"alto"},{"n":2,"decision":"Una lista de precios única está regalando margen","oferta":"El factor de posicionamiento 0,55 deja a KIMOS 45% bajo la mediana del mercado, que se calculó sobre precios de lista estadounidenses.","demanda":"La disposición a pagar en LATAM está 40-60% bajo EE.UU., pero en Norteamérica y Europa el índice es 1,00 y 0,95.","hacer":"Mantener 0,55 en LATAM y subir a 0,85-0,90 en Norteamérica y Europa. Es la misma lista con tres precios, no tres productos.","impacto":"alto"},{"n":3,"decision":"Los kits no son una simplificación comercial: son una decisión de conversión","oferta":"El Enterprise sale USD 777 al mes; los kits, entre USD 204 y 263.","demanda":"Cada participante adicional en el comité suma entre 12% y 22% de probabilidad de que el deal se estanque, y los deals bajo USD 15K cierran en 14-30 días.","hacer":"Hacer del kit la oferta de entrada por defecto y dejar el Enterprise para expansión, no para adquisición.","impacto":"alto"},{"n":4,"decision":"El riesgo no está en el precio: está en los primeros 90 días","oferta":"24 módulos significan una superficie de producto enorme y un tiempo hasta el primer valor mucho más largo que el de una herramienta única.","demanda":"Entre el 40% y el 60% del churn ocurre antes del tercer mes, y un onboarding estructurado sube la retención del primer año un 25%.","hacer":"Onboarding pagado y obligatorio en PIM, BPM y Cashflow, y activación guiada a un solo módulo en los planes de entrada.","impacto":"alto"},{"n":5,"decision":"Publicar precios no es transparencia: es un requisito de entrada","oferta":"Pipedrive, Shopify, Notion y Plytix publican todo. Los que no publican juegan en enterprise con equipo de ventas propio.","demanda":"El 69% del proceso de compra ocurre sin contacto comercial y el 83% de los compradores llega con requisitos ya definidos.","hacer":"Publicar lista completa por región y una comparativa propia contra el stack típico. Sin eso KIMOS no entra a la lista corta.","impacto":"alto"},{"n":6,"decision":"Vender IA como promesa produce cancelaciones","oferta":"El Escritorio y los Agentes son el diferenciador más fuerte de la suite y el único que ningún competidor replica dentro de un mismo login.","demanda":"El 42% de las PyMEs ya empezó a implementar IA, pero solo el 23% captura valor económico medible y 6 de cada 10 no capturan nada.","hacer":"Instrumentar y mostrar el ahorro de horas por agente dentro del producto. La IA se cobra por resultado medido, no por acceso.","impacto":"alto"},{"n":7,"decision":"Hay módulos que sostienen la suite y módulos que solo la engordan","oferta":"PIM, CRM, BPM y Dashboards concentran el precio sugerido; Vitrina, Integraciones y Formularios aportan casi nada al ticket.","demanda":"El dolor de fragmentación es mayor en mid-market, que corre 187 apps, que en la pequeña empresa, que corre 87.","hacer":"Concentrar roadmap y soporte en los cuatro primeros y mover el resto a mantención. Ver la matriz de cartera de esta misma pestaña.","impacto":"medio"},{"n":8,"decision":"El mercado grande y el mercado alcanzable no son el mismo","oferta":"El producto compite de igual a igual con proveedores locales, pero contra Microsoft, Google y Shopify no.","demanda":"Norteamérica es el 46% del mercado SaaS mundial, pero la cobertura comercial realista de KIMOS allí es baja; LATAM es solo el 5,6% y es donde tiene ventaja de idioma, cercanía y soporte.","hacer":"Financiar la expansión global con la caja del mercado hispano, no al revés. Entrar a Norteamérica por producto, no por fuerza de ventas.","impacto":"medio"}],"notas":["1. 140 de 154 precios fueron verificados en fuente. Los 14 restantes dicen 'Estimado' en la columna J.","2. Precios de lista públicos al 16-ago-2026, sin descuentos por volumen ni negociación.","3. La normalización compara costo total, no paridad funcional. Revisar features antes de anclar precio.","4. Agicap, Cvent y Salsify no publican precio: sus cifras son estimaciones de mercado.","5. La mediana excluye planes Enterprise (Akeneo, Salsify, Cvent, Bizzabo, Kissflow, Nintex): son otro segmento y distorsionan la referencia.","6. Digitai y Agentes se solapan como categoría. Evaluar fusionarlos en un solo módulo.","La nota 1 se refiere al levantamiento original de agosto-2026 (154 planes, 140 verificados). La ampliación del 1-sep-2026 añadió el módulo 25 y 16 planes más: 9 con precio de lista público y 7 estimados desde contratos anuales reportados por terceros, porque en inteligencia competitiva los proveedores grandes no publican tarifa. Los totales vigentes están siempre a la vista en la cabecera y en la pestaña Precios por App.","En el módulo 25 las plataformas que cobran por asiento pero se contratan por equipo (AlphaSense, Statista, Semrush) se registran como tarifa plana con el detalle de asientos en la nota. Multiplicarlas por la dotación del cliente tipo habría inflado la mediana de una categoría que en la práctica usan dos o tres personas por empresa."]};
const VIS = {"paths":{"monitor":"<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M8 21h8M12 17v4\"/>","bot":"<rect x=\"3\" y=\"11\" width=\"18\" height=\"10\" rx=\"2\"/><circle cx=\"12\" cy=\"5\" r=\"2\"/><path d=\"M12 7v4M8 16h.01M16 16h.01\"/>","message":"<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>","folder":"<path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>","book":"<path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20\"/><path d=\"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z\"/>","users":"<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/>","columns":"<rect x=\"3\" y=\"3\" width=\"6\" height=\"18\" rx=\"1\"/><rect x=\"15\" y=\"3\" width=\"6\" height=\"12\" rx=\"1\"/>","calendar":"<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/>","note":"<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6M9 13h6M9 17h4\"/>","chart":"<path d=\"M3 3v18h18\"/><path d=\"M7 15l4-5 3 3 5-7\"/>","flow":"<rect x=\"2\" y=\"3\" width=\"7\" height=\"6\" rx=\"1\"/><rect x=\"15\" y=\"15\" width=\"7\" height=\"6\" rx=\"1\"/><path d=\"M5.5 9v5a4 4 0 0 0 4 4h5.5\"/>","cpu":"<rect x=\"5\" y=\"5\" width=\"14\" height=\"14\" rx=\"2\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\"/><path d=\"M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4\"/>","form":"<rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\"/><path d=\"M8 7h8M8 12h8M8 17h4\"/>","target":"<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/>","share":"<circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"M8.6 13.5l6.8 4M15.4 6.5l-6.8 4\"/>","palette":"<circle cx=\"13.5\" cy=\"6.5\" r=\"1.5\"/><circle cx=\"17.5\" cy=\"10.5\" r=\"1.5\"/><circle cx=\"8.5\" cy=\"7.5\" r=\"1.5\"/><circle cx=\"6.5\" cy=\"12.5\" r=\"1.5\"/><path d=\"M12 2a10 10 0 1 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.6-.4-1 0-.9.7-1.6 1.6-1.6H16a6 6 0 0 0 6-6c0-4.9-4.5-8.7-10-8.7z\"/>","game":"<path d=\"M6 12h4M8 10v4M15 13h.01M18 11h.01\"/><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"5\"/>","flask":"<path d=\"M9 2v6.5L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19l-5-10.5V2\"/><path d=\"M8 2h8M7 15h10\"/>","box":"<path d=\"M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"/><path d=\"M3.3 7L12 12l8.7-5M12 22V12\"/>","cart":"<circle cx=\"9\" cy=\"21\" r=\"1\"/><circle cx=\"20\" cy=\"21\" r=\"1\"/><path d=\"M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6\"/>","store":"<path d=\"M3 9l1.5-5h15L21 9M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z\"/><path d=\"M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0\"/>","coins":"<circle cx=\"8\" cy=\"8\" r=\"6\"/><path d=\"M18.1 10.4a6 6 0 1 1-7.7 7.7\"/><path d=\"M7 6h2v4M9.5 14H7\"/>","ticket":"<path d=\"M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z\"/><path d=\"M13 5v14\"/>","plug":"<path d=\"M12 22v-5M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z\"/>"},"scores":[{"dim":"Amplitud funcional de la suite","nota":9,"texto":"24 módulos cubriendo desde CRM hasta PIM. Ningún competidor de este tamaño ofrece tanto bajo un mismo login."},{"dim":"Integración entre módulos","nota":8,"texto":"Es la ventaja real y la única defendible: el dato fluye sin conectores. Todo el pricing debe apoyarse aquí."},{"dim":"Capa de IA y agentes","nota":8,"texto":"Escritorio con agentes, chatbots web y automatización de datos ya integrados. La competencia vende el asistente aparte."},{"dim":"Profundidad por módulo","nota":4,"texto":"Aquí está la debilidad. Contra Shopify, Notion, Canva o Salesforce, cada módulo individual es más pobre. Es el precio inevitable de la amplitud."},{"dim":"Ecosistema y comunidad","nota":3,"texto":"Sin app store, sin partners, sin plantillas de comunidad. Shopify y Notion construyeron eso en una década."},{"dim":"Posición de precio","nota":8,"texto":"Entrar al 28% del gasto actual del cliente con ahorro demostrable es una posición comercial muy sólida."},{"dim":"Escalabilidad del soporte","nota":4,"texto":"24 módulos significan 24 frentes de soporte, documentación y roadmap. Es el mayor riesgo operativo del modelo."},{"dim":"Defensa ante grandes","nota":5,"texto":"Microsoft y Google regalan piezas del stack. La defensa no es funcional, es el costo de cambio de tener todo integrado."}],"tldr":[{"titulo":"El número que importa","color":"orange","texto":"Un cliente del tamaño tipo gasta hoy <b>{stack} al mes<\/b> armando el stack por su cuenta. Ese es el ancla de la negociación, no el precio de cada competidor suelto."},{"titulo":"Dónde está la plata","color":"fuchsia","texto":"<b>{top3}<\/b> concentran la disposición a pagar. Kanban, Formularios, Vitrina e Integraciones son commodities: sirven para entrar a la cuenta, no para facturar."},{"titulo":"La suma de partes no es un precio","color":"violet","texto":"Sin descuento de bundle la suite daría <b>{aLaCarta}/mes<\/b>. Nadie paga eso. El descuento por plan no es una concesión comercial: es el modelo de precio."},{"titulo":"No todo se cobra por asiento","color":"cyan","texto":"Cashflow, PIM, Tienda, BPM y Eventos se cobran plano en todo el mercado. Cobrarlos por usuario deja a KIMOS fuera de comparación en la evaluación del cliente."},{"titulo":"Dos categorías a no pelear","color":"red","texto":"Chat de equipo (Slack/Teams) y e-commerce (Shopify) tienen efecto de red y ecosistemas imposibles de igualar en el corto plazo. Integrarse rinde más que competir."},{"titulo":"El riesgo real","color":"amber","texto":"24 módulos es una superficie de producto enorme para mantener. La amenaza no es el precio de la competencia: es quedarse a medias en veinte frentes a la vez."}],"sugerencias":[{"titulo":"Fusiona Digitai con Agentes","color":"fuchsia","texto":"Son la misma promesa para el cliente: automatizar con IA. Dos SKUs que se solapan generan fricción en la venta y canibalizan precio. Un solo módulo con niveles de consumo es más claro y más caro de vender bien."},{"titulo":"No pelees el chat ni el e-commerce","color":"red","texto":"Equipos compite con Slack y Teams, que tienen efecto de red; Tienda compite con Shopify y su app store. Integrarse con ellos convierte dos debilidades en dos argumentos de venta. Insistir cuesta roadmap que rinde más en BPM o PIM."},{"titulo":"Concentra el roadmap en 5 módulos","color":"violet","texto":"Prospección, PIM, BPM, Dashboards y Agentes Web concentran la disposición a pagar. Los demás son de retención, no de ingreso. Repartir esfuerzo por igual entre 24 módulos es la forma más rápida de quedar mediocre en todos."},{"titulo":"Cobra por unidad de valor, no por asiento","color":"cyan","texto":"Cashflow por empresa, PIM por volumen de SKU, Social Planner por canal, Eventos por evento, Agentes por crédito. Forzar todo a \"por usuario\" deja a KIMOS fuera de comparación justo cuando el cliente arma su planilla."},{"titulo":"Vende kits antes que la suite completa","color":"teal","texto":"El Enterprise de {enterprise}/mes exige un comité de compra y un ciclo largo. Los kits de {kitMin}–{kitMax} los aprueba un gerente de área con presupuesto propio. Entra por el kit, expande después: el costo de adquisición es una fracción."},{"titulo":"Publica precios","color":"orange","texto":"Pipedrive, Shopify, Notion y Plytix publican todo. Los que no publican (Agicap, Cvent, Salsify) juegan en enterprise con equipo de ventas. Si KIMOS apunta a PyME y no publica precios, pierde antes de la primera reunión."},{"titulo":"Instrumenta el uso por módulo","color":"blue","texto":"Sin datos de adopción por módulo, el pricing es una hipótesis. Medir qué se usa de verdad permite mover módulos entre planes con evidencia y detectar cuáles no justifican su costo de mantención."},{"titulo":"Cierra la brecha de datos","color":"amber","texto":"{estimados} de {totalPlanes} precios siguen estimados y Agicap, Cvent y Salsify no publican tarifas. Antes de fijar lista definitiva conviene cerrar esa brecha: una mediana mal calculada arrastra el error a todo el modelo aguas abajo."}],"conclusiones":[{"color":"green","titulo":"Desarrollo: la apuesta es correcta, la ejecución es el riesgo","texto":"KIMOS no está compitiendo con Trello ni con Pipedrive. Está compitiendo con <b>la suma de doce suscripciones sueltas<\/b>, y ahí la posición es genuinamente buena: {stack} al mes de gasto disperso contra {enterprise} integrados. Ese diferencial es real y defendible. Pero la amplitud que hoy es la ventaja es también la amenaza: ninguna organización pequeña mantiene 24 módulos al nivel de sus especialistas. La pregunta no es si KIMOS puede construirlos —evidentemente ya lo hizo— sino si puede sostenerlos sin que la calidad promedio caiga por debajo del umbral en que el cliente empieza a recomprar herramientas sueltas por fuera. Ese es el punto de quiebre a vigilar."},{"color":"cyan","titulo":"Implementación: el producto se vende solo si el onboarding no lo hunde","texto":"Los módulos de mayor valor —PIM, BPM, Cashflow— son justamente los que exigen migración de datos, integración con bancos o ERPs locales y consultoría de procesos. En PIM, la industria entera sabe que el proyecto se juega en la preparación de datos, no en el software. Si KIMOS los vende como autoservicio, el churn se lo come en el primer trimestre. Recomendación concreta: precio de licencia agresivo y <b>onboarding pagado y obligatorio<\/b> en esos tres módulos, al estilo del fee de USD 1.500 de HubSpot. Eso filtra clientes que no están listos y financia el costo real de implementar."},{"color":"fuchsia","titulo":"Escalabilidad: el modelo escala, la organización es la duda","texto":"Comercialmente el modelo escala bien: la estructura de kits permite entrar barato y expandir sin renegociar el contrato, y el precio por unidad de valor —SKU, canal, evento, crédito— crece con el cliente sin castigar la adopción interna, que es el error clásico del cobro por asiento. Técnicamente, la capa de IA introduce <b>costo variable que KIMOS no controla<\/b>: si el precio del token sube, el margen se comprime en silencio; conviene modelar ese costo por plan antes de publicar tarifas. El cuello real es organizacional: 24 módulos son 24 backlogs, 24 documentaciones y 24 filas de soporte. Sin instrumentar la adopción por módulo y sin la disciplina de congelar o discontinuar los que no rinden, el producto se vuelve inmanejable mucho antes de volverse rentable."},{"color":"orange","titulo":"La decisión de precio, en una línea","texto":"Entrar entre el <b>28% y el 35% del gasto actual<\/b> del cliente, vender kits en lugar de la suite completa, cobrar cada módulo en su unidad natural de valor y financiar la implementación aparte. Con ese esquema el ahorro anual para el cliente supera los {ahorroAnual} y KIMOS conserva margen para sostener el roadmap. Lo que hundiría el modelo no es un precio mal puesto: es prometer veinticuatro productos y entregar veinticuatro medianías."}],"notas":{"resumen":{"titulo":"Cómo leer esto.","texto":"Todo lo que ves se recalcula solo. Mueve los controles de la pestaña Precios por App o edita cualquier precio de la competencia y el modelo completo se actualiza, incluidos los planes, los kits y el configurador. El número que importa no es el precio de cada competidor por separado, sino cuánto gasta hoy un cliente sumando todas las herramientas que KIMOS reemplaza."},"factor":{"titulo":"Factor de posicionamiento.","texto":"0,55 significa entrar un 45% bajo la mediana del mercado: estrategia challenger, se gana por precio. Súbelo a 0,80–0,90 si la venta se gana por integración de suite y no por ser el más barato. Es la palanca más sensible de todo el modelo."},"banda":{"titulo":"Regla de calibración.","texto":"La banda sana es 25%–60% del gasto actual del cliente. Sobre 60% se cae el argumento de ahorro y la venta se vuelve una discusión de features. Bajo 25% estás dejando margen sobre la mesa y además generas dudas sobre la calidad del producto."},"proscontras":{"titulo":"Sin adornos.","texto":"Cada tarjeta dice qué tiene KIMOS a favor y qué tiene en contra frente a la competencia real de esa categoría. Donde la posición es mala, lo dice. Un estudio que solo lista fortalezas no sirve para decidir precios."}}};

// Los iconos son parte de la app, no del estudio: no cambian al analizar otra empresa.
const PATHS = VIS.paths;

/* ------------------------------------------------------------------ *
 * El estudio como documento
 *
 * Hasta la 1.2.0 el estudio de KIMOS ERA la app: los datos estaban clavados
 * en el bundle. Desde la 2.0.0 el estudio es un documento que vive en la
 * instancia: se puede editar, exportar, importar y empezar de cero con una
 * plantilla de otro rubro. El estudio de KIMOS es solo la semilla con la que
 * abre una ventana nueva, y el motor de cálculo es el mismo para cualquiera.
 * ------------------------------------------------------------------ */

const clon = (o) => JSON.parse(JSON.stringify(o));

function docSemilla() {
  const d = clon(DATA);
  d.meta = Object.assign({
    empresa: 'KIMOS',
    rubro: 'Suite de gestión empresarial para PyME (SaaS B2B)',
    autor: 'Estudio interno de KIMOS',
    plantilla: 'kimos',
    titulo: 'Estudio de Mercado y Modelo de Precios',
    unidadNegocio: 'aplicaciones',
  }, d.meta);
  d.visual = {
    scores: clon(VIS.scores), tldr: clon(VIS.tldr), sugerencias: clon(VIS.sugerencias),
    conclusiones: clon(VIS.conclusiones), notas: clon(VIS.notas),
  };
  return d;
}

/* ------------------------------------------------------------------ *
 * Plantillas por rubro
 *
 * Una plantilla NO trae precios: trae la estructura del rubro (qué líneas de
 * producto se comparan, contra qué categoría de competidor) y de dónde salen
 * los datos en ese sector. Los números los pone la investigación, porque un
 * estudio con cifras inventadas es peor que no tener estudio.
 * ------------------------------------------------------------------ */

const PLANTILLAS = [
  {
    id: 'saas', nombre: 'Software B2B / SaaS', icono: '⌘',
    rubro: 'Software de gestión por suscripción (B2B)',
    unidadNegocio: 'módulos', unidadPrecio: 'Por usuario',
    sup: { usuarios: 10, canales: 5, factor: 0.55, descAnual: 0.2 },
    lineas: [
      ['Gestión de clientes (CRM)', 'CRM y automatización comercial', 'HubSpot, Pipedrive, Zoho CRM', 'Registro de oportunidades, embudo y seguimiento comercial'],
      ['Proyectos y tareas', 'Gestión de trabajo', 'Asana, Monday, ClickUp, Trello', 'Tableros, plazos y carga de trabajo del equipo'],
      ['Facturación y cobranza', 'Facturación electrónica y cuentas por cobrar', 'Facturación local, QuickBooks, Xero', 'Emisión de documentos, cobranza y conciliación'],
      ['Soporte y mesa de ayuda', 'Atención al cliente', 'Zendesk, Freshdesk, Intercom', 'Tickets, base de conocimiento y acuerdos de servicio'],
      ['Automatización e IA', 'Agentes e integraciones', 'Zapier, Make, ChatGPT Business', 'Flujos entre sistemas y asistentes sobre datos propios'],
      ['Informes y tablero', 'Business intelligence', 'Power BI, Looker Studio, Metabase', 'Indicadores del negocio en un solo lugar'],
    ],
    fuentes: [
      'Página de precios del propio proveedor: es la única fuente que se marca "Verificado".',
      'Cuando el proveedor cotiza a puerta cerrada (todo lo "Enterprise"), usar contratos reportados por G2, Vendr, Capterra o TrustRadius y dividir el anual en doce; la fila queda "Estimado".',
      'Tamaño de mercado: informes de Gartner, IDC o consultoras de mercado; contrastar siempre dos fuentes, porque la horquilla entre definiciones es enorme.',
      'Benchmarks de churn, CAC y margen: informes anuales de SaaS Capital, ChartMogul, OpenView o Paddle.',
    ],
  },
  {
    id: 'retail', nombre: 'Comercio y e-commerce', icono: '🛒',
    rubro: 'Comercio minorista y venta en línea',
    unidadNegocio: 'líneas de producto', unidadPrecio: 'Plano',
    sup: { usuarios: 8, canales: 4, factor: 0.6, descAnual: 0.15 },
    lineas: [
      ['Línea de producto A', 'Categoría de mayor rotación', 'Competidores directos de la categoría', 'Producto o familia que más factura'],
      ['Línea de producto B', 'Categoría secundaria', 'Competidores directos de la categoría', 'Segunda familia en facturación'],
      ['Marca propia', 'Marca blanca frente a marcas líderes', 'Marcas nacionales e importadas', 'Producto propio con margen mayor'],
      ['Servicios asociados', 'Instalación, garantía extendida, despacho', 'Retailers grandes y especialistas', 'Lo que se cobra además del producto'],
      ['Canal en línea', 'E-commerce propio y marketplaces', 'Marketplaces y tiendas de la competencia', 'Precio de lista publicado en el canal digital'],
    ],
    fuentes: [
      'Precio publicado en la ficha del competidor (tienda física o en línea), con fecha y captura: en retail el precio cambia semana a semana.',
      'Marketplaces del país para el precio de referencia de la categoría y la dispersión entre vendedores.',
      'Organismos de estadística nacionales para el tamaño del mercado y el gasto por hogar de la categoría.',
      'Asociaciones gremiales del comercio para participación por canal y estacionalidad.',
    ],
  },
  {
    id: 'servicios', nombre: 'Servicios profesionales', icono: '⚖',
    rubro: 'Consultoría, estudios y agencias',
    unidadNegocio: 'servicios', unidadPrecio: 'Plano',
    sup: { usuarios: 6, canales: 3, factor: 0.7, descAnual: 0.1 },
    lineas: [
      ['Asesoría mensual (retainer)', 'Contrato recurrente', 'Estudios y consultoras del mismo tamaño', 'Servicio continuo facturado mes a mes'],
      ['Proyecto llave en mano', 'Proyecto cerrado', 'Consultoras medianas y grandes', 'Alcance definido, precio cerrado'],
      ['Hora profesional', 'Tarifa por hora', 'Tarifario del gremio y competidores', 'Valor hora por seniority'],
      ['Auditoría o diagnóstico', 'Servicio de entrada', 'Competidores y consultoras grandes', 'El servicio con el que entra un cliente nuevo'],
      ['Capacitación', 'Formación a empresas', 'Escuelas de negocio y capacitadores', 'Programas cerrados o abiertos'],
    ],
    fuentes: [
      'Tarifarios publicados por colegios profesionales y asociaciones gremiales: en servicios suelen ser la única referencia pública.',
      'Licitaciones y compras públicas del país: las adjudicaciones muestran precios reales de la competencia, con nombre y monto.',
      'Propuestas comerciales recibidas por clientes (con su permiso y anonimizadas), marcadas siempre como "Estimado".',
      'Encuestas salariales del sector para reconstruir el costo por hora y verificar que la tarifa deja margen.',
    ],
  },
  {
    id: 'salud', nombre: 'Salud y centros médicos', icono: '⚕',
    rubro: 'Prestadores de salud ambulatoria',
    unidadNegocio: 'prestaciones', unidadPrecio: 'Plano',
    sup: { usuarios: 12, canales: 3, factor: 0.75, descAnual: 0.1 },
    lineas: [
      ['Consulta general', 'Atención ambulatoria', 'Centros médicos de la zona', 'Consulta de medicina general'],
      ['Consulta de especialidad', 'Especialidades', 'Clínicas y centros especializados', 'Consulta con especialista'],
      ['Exámenes de laboratorio', 'Laboratorio clínico', 'Laboratorios de la zona', 'Panel de exámenes más pedido'],
      ['Imagenología', 'Diagnóstico por imagen', 'Centros de imágenes', 'Ecografía, radiografía y similares'],
      ['Procedimientos', 'Procedimientos ambulatorios', 'Clínicas ambulatorias', 'Procedimientos que no requieren pabellón'],
      ['Planes preventivos', 'Programas de salud', 'Aseguradoras y centros con planes', 'Paquetes de chequeo anual'],
    ],
    fuentes: [
      'Aranceles publicados por el prestador y por el asegurador o sistema público: en salud casi siempre son públicos y auditables.',
      'Comparadores oficiales de precios de prestaciones donde existan, con la fecha del arancel.',
      'Estadísticas del ministerio o autoridad sanitaria para volumen de prestaciones y cobertura del mercado.',
      'Nunca usar precios de convenio sin declararlo: el precio de lista y el precio con convenio son dos filas distintas.',
    ],
  },
  {
    id: 'educacion', nombre: 'Educación y formación', icono: '🎓',
    rubro: 'Formación técnica, profesional y continua',
    unidadNegocio: 'programas', unidadPrecio: 'Plano',
    sup: { usuarios: 20, canales: 2, factor: 0.65, descAnual: 0.15 },
    lineas: [
      ['Curso corto', 'Formación continua', 'Institutos y plataformas en línea', 'Programa de pocas semanas'],
      ['Diplomado', 'Posgrado corto', 'Universidades y centros de formación', 'Programa de varios meses'],
      ['Programa para empresas', 'Capacitación corporativa', 'Consultoras y escuelas de negocio', 'Formación cerrada a medida'],
      ['Suscripción a la plataforma', 'Aprendizaje en línea', 'Coursera, Udemy Business, plataformas locales', 'Acceso al catálogo por persona'],
      ['Certificación', 'Certificación oficial', 'Certificadoras del sector', 'Examen y credencial'],
    ],
    fuentes: [
      'Arancel publicado por cada institución para el año en curso: en educación el precio de lista es público por obligación en muchos países.',
      'Registros oficiales de matrícula y aranceles del ministerio de educación para tamaño de mercado y precio medio.',
      'Franquicias tributarias de capacitación donde existan: fijan un techo de precio que el mercado respeta.',
      'Precio por hora de formación como métrica normalizadora: los programas duran distinto y no se comparan de otro modo.',
    ],
  },
  {
    id: 'manufactura', nombre: 'Manufactura e industria', icono: '⚙',
    rubro: 'Fabricación y venta industrial',
    unidadNegocio: 'familias de producto', unidadPrecio: 'Plano',
    sup: { usuarios: 15, canales: 4, factor: 0.72, descAnual: 0.12 },
    lineas: [
      ['Familia de producto principal', 'Producto estándar de catálogo', 'Fabricantes nacionales e importadores', 'El producto que sostiene la planta'],
      ['Producto a pedido', 'Fabricación a medida', 'Talleres y fabricantes especializados', 'Producción contra orden'],
      ['Repuestos y consumibles', 'Posventa', 'Fabricantes y distribuidores', 'Ingreso recurrente de la base instalada'],
      ['Servicio técnico', 'Mantenimiento', 'Servicios técnicos autorizados', 'Contratos de mantención'],
      ['Distribución', 'Venta a distribuidores', 'Otros fabricantes en el canal', 'Precio de lista al canal, no al cliente final'],
    ],
    fuentes: [
      'Listas de precios del canal y catálogos de distribuidores: en industrial el precio de lista existe pero vive en PDF.',
      'Estadísticas de comercio exterior del país (importaciones por partida arancelaria) para precio de referencia y volumen.',
      'Ferias y licitaciones industriales para precios adjudicados con nombre del proveedor.',
      'Separar siempre precio de lista, precio al canal y precio con volumen: son tres filas, no una.',
    ],
  },
  {
    id: 'horeca', nombre: 'Restaurantes, hotelería y turismo', icono: '🍽',
    rubro: 'Alimentación, alojamiento y turismo',
    unidadNegocio: 'servicios', unidadPrecio: 'Plano',
    sup: { usuarios: 10, canales: 4, factor: 0.8, descAnual: 0.1 },
    lineas: [
      ['Ticket promedio', 'Consumo por visita', 'Locales del mismo segmento y zona', 'Lo que gasta un cliente por visita'],
      ['Menú ejecutivo', 'Almuerzo de semana', 'Locales de la zona', 'Producto de mayor rotación'],
      ['Habitación estándar', 'Alojamiento', 'Hoteles del mismo rango y zona', 'Tarifa por noche publicada'],
      ['Eventos y banquetes', 'Servicio para grupos', 'Centros de eventos y hoteles', 'Precio por persona en evento cerrado'],
      ['Delivery y canales', 'Venta por plataforma', 'Locales en las mismas plataformas', 'Precio en la plataforma, con su comisión'],
    ],
    fuentes: [
      'Cartas y tarifas publicadas del competidor, con fecha: en este rubro el precio es público por definición.',
      'Plataformas de reserva y de delivery para tarifa vigente y ocupación aparente, distinguiendo el precio con comisión del precio en local.',
      'Estadísticas oficiales de turismo para ocupación, tarifa media y estacionalidad.',
      'Registrar la temporada de cada precio: la misma habitación cambia de precio tres veces al año.',
    ],
  },
  {
    id: 'logistica', nombre: 'Logística y transporte', icono: '🚚',
    rubro: 'Transporte, almacenaje y última milla',
    unidadNegocio: 'servicios', unidadPrecio: 'Plano',
    sup: { usuarios: 12, canales: 5, factor: 0.7, descAnual: 0.12 },
    lineas: [
      ['Última milla', 'Reparto urbano', 'Couriers nacionales y locales', 'Entrega por paquete en ciudad'],
      ['Carga nacional', 'Transporte terrestre', 'Empresas de carga', 'Flete por tonelada o por pallet'],
      ['Almacenaje', 'Bodegaje', 'Operadores logísticos', 'Metro cuadrado o posición pallet al mes'],
      ['Fulfillment', 'Preparación de pedidos', 'Operadores de e-commerce', 'Costo por pedido preparado'],
      ['Logística inversa', 'Devoluciones', 'Couriers y operadores', 'Costo por devolución gestionada'],
    ],
    fuentes: [
      'Tarifarios publicados por couriers y operadores, y sus cotizadores en línea: dan precio por tramo, peso y volumen.',
      'Licitaciones logísticas y compras públicas para precios adjudicados reales.',
      'Índices oficiales de costo de transporte para actualizar precios viejos a moneda de hoy.',
      'Normalizar siempre a la misma unidad (paquete, pallet, tonelada-kilómetro) antes de comparar.',
    ],
  },
  {
    id: 'blanco', nombre: 'Estudio en blanco', icono: '□',
    rubro: '',
    unidadNegocio: 'líneas de producto', unidadPrecio: 'Plano',
    sup: { usuarios: 10, canales: 5, factor: 0.6, descAnual: 0.15 },
    lineas: [
      ['Línea 1', '', '', ''],
      ['Línea 2', '', '', ''],
      ['Línea 3', '', '', ''],
    ],
    fuentes: [
      'Precio de lista publicado por el propio competidor: la única fuente que se marca "Verificado".',
      'Terceros que reportan contratos (comparadores, reseñas, licitaciones) para lo que no se publica: siempre "Estimado".',
      'Dos fuentes independientes para cualquier cifra de tamaño de mercado.',
      'Fecha en todo: un precio sin fecha no es un dato.',
    ],
  },
];

/**
 * El protocolo no es decorativo: es lo que hace que el estudio de otra empresa
 * valga lo mismo que el de KIMOS. Lo lee la persona en pantalla y lo lee el
 * agente por la herramienta PROTOCOLO.
 */
const PROTOCOLO = [
  {
    n: 1, titulo: 'Definir el cliente tipo antes que nada',
    texto: 'Todo precio se compara normalizado a un mismo cliente: cuántos usuarios, cuántos canales, qué tamaño. Sin cliente tipo, comparar un precio por usuario con una tarifa plana es comparar cualquier cosa. Es el primer control de la pestaña Precios y el que manda sobre el resto del modelo.',
  },
  {
    n: 2, titulo: 'Una línea de producto, una categoría de mercado',
    texto: 'Cada línea del negocio se enfrenta a la categoría en que realmente compite, no a la que le gustaría. Si una línea no tiene competidor claro, eso también es un hallazgo: significa que no hay mercado hecho o que el cliente lo resuelve de otra forma.',
  },
  {
    n: 3, titulo: 'Precio de lista público primero',
    texto: 'Se busca el precio publicado por el propio proveedor, con su plan y su unidad de cobro. Esa fila y solo esa se marca "Verificado". Se registra la fuente completa, porque en seis meses nadie recuerda de dónde salió el número.',
  },
  {
    n: 4, titulo: 'Lo que no se publica se estima, y se dice',
    texto: 'Cuando el proveedor cotiza a puerta cerrada, se usan contratos reportados por terceros y se divide el anual en doce. La fila queda "Estimado" y la nota dice el rango completo, no solo el punto medio. Un estudio honesto muestra su propia incertidumbre.',
  },
  {
    n: 5, titulo: 'Excluir el segmento que no es el tuyo de la mediana',
    texto: 'Los planes corporativos marcan el techo del mercado pero no el precio de referencia. Entran al máximo y quedan fuera de la mediana. Si no se hace, la mediana se dispara y el precio sugerido queda alto sin razón.',
  },
  {
    n: 6, titulo: 'El precio sugerido sale de la mediana, no del costo',
    texto: 'Precio sugerido = mediana de la categoría × factor de posicionamiento. El factor es la decisión comercial: bajo 0,6 se entra por precio, sobre 0,8 se entra por valor. Es un supuesto editable, no una verdad.',
  },
  {
    n: 7, titulo: 'Demanda con dos fuentes o no se usa',
    texto: 'El tamaño de mercado se toma de fuentes públicas y se contrasta con una segunda. Si las dos difieren mucho, se cargan las dos y se muestra la horquilla: eso mide cuánto cambia el número según qué se cuente.',
  },
  {
    n: 8, titulo: 'Cerrar con economía por cliente',
    texto: 'Un precio sin LTV, CAC y payback es una opinión. Con churn, margen y costo de adquisición el estudio dice si el precio sostiene el negocio o solo la venta.',
  },
  {
    n: 9, titulo: 'Fechar y volver a levantar',
    texto: 'Un estudio de precios envejece: a los seis meses hay que revisarlo y a los doce ya no sirve para decidir. La app avisa sola cuando el levantamiento pasa esa edad.',
  },
];

function hoyISO() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Crea un estudio vacío con la estructura del rubro elegido. Sin cifras. */
function docPlantilla(id, empresa) {
  const t = PLANTILLAS.filter((x) => x.id === id)[0] || PLANTILLAS[PLANTILLAS.length - 1];
  const modulos = t.lineas.map((l, i) => ({
    n: i + 1, app: l[0], que: l[3] || '', cat: l[1] || '', alt: l[2] || '',
    target: '', pro: '', contra: '', estrategia: '', conf: '0/0', ventaja: 5, icono: 'target',
  }));
  const ns = modulos.map((m) => m.n);
  const tramo = (k) => ns.slice(0, Math.max(1, Math.ceil(ns.length * k)));
  const planes = [
    { id: 'starter', nombre: 'Básico', para: 'Entrada al servicio', incluye: '', mods: tramo(0.4), desc: 0.2 },
    { id: 'business', nombre: 'Profesional', para: 'El plan del grueso de los clientes', incluye: '', mods: tramo(0.75), desc: 0.35 },
    { id: 'enterprise', nombre: 'Corporativo', para: 'Todo el catálogo', incluye: '', mods: ns.slice(), desc: 0.5 },
  ];
  const params = clon(DATA.demanda.params);
  Object.keys(params).forEach((k) => { params[k].nota = 'Heredado del estudio semilla: reemplazar con dato propio.'; });
  return {
    meta: {
      empresa: empresa || '', rubro: t.rubro, moneda: 'USD', fecha: hoyISO(),
      fuente: '', autor: '', plantilla: t.id, unidadNegocio: t.unidadNegocio,
      titulo: 'Estudio de Mercado y Modelo de Precios',
    },
    supuestos: Object.assign({}, t.sup),
    modulos: modulos,
    competidores: [],
    planes: planes,
    kits: [],
    stack: [],
    demanda: {
      params: params,
      regiones: [], paises: [],
      mixPlan: [{ plan: 'Starter', peso: 0.5 }, { plan: 'Business', peso: 0.35 }, { plan: 'Enterprise', peso: 0.15 }],
      mixRegion: [],
    },
    evidencia: [], icp: [], segmentos: [], decisiones: [],
    notas: ['Estudio en blanco creado con la plantilla "' + t.nombre + '" el ' + hoyISO()
      + '. Todavía no tiene ni un precio: el protocolo de la pestaña "Este estudio" dice en qué orden llenarlo y qué fuentes sirven en este rubro.'],
    visual: { scores: [], tldr: [], sugerencias: [], conclusiones: [], notas: clon(VIS.notas) },
  };
}

/** Comprueba que un JSON importado sea un estudio y no cualquier otra cosa. */
function validarDoc(o) {
  if (!o || typeof o !== 'object') return 'El archivo no contiene un objeto JSON.';
  const listas = ['modulos', 'competidores', 'planes', 'kits', 'stack', 'evidencia', 'icp', 'segmentos', 'decisiones', 'notas'];
  for (const k of listas) if (!Array.isArray(o[k])) return 'Falta la lista "' + k + '".';
  if (!o.meta || typeof o.meta !== 'object') return 'Falta el bloque "meta" con la identidad del estudio.';
  if (!o.supuestos || typeof o.supuestos !== 'object') return 'Falta el bloque "supuestos".';
  if (!o.demanda || !o.demanda.params || !Array.isArray(o.demanda.paises)) return 'Falta el bloque "demanda" con params y paises.';
  if (!Array.isArray(o.demanda.mixPlan)) return 'Falta demanda.mixPlan.';
  if (!Array.isArray(o.demanda.regiones)) return 'Falta demanda.regiones.';
  for (const c of ['gastoSuites', 'pymeShare', 'segmento', 'churn', 'margen', 'cac', 'clientes3']) {
    if (!o.demanda.params[c] || typeof o.demanda.params[c].valor !== 'number') return 'Falta el parámetro "' + c + '" en demanda.params.';
  }
  for (const m of o.modulos) if (typeof m.n !== 'number' || !m.app) return 'Hay un módulo sin número o sin nombre.';
  for (const p of o.planes.concat(o.kits)) if (!p.id || !Array.isArray(p.mods)) return 'Hay un plan sin id o sin lista de módulos.';
  if (!o.visual || typeof o.visual !== 'object') o.visual = { scores: [], tldr: [], sugerencias: [], conclusiones: [], notas: clon(VIS.notas) };
  for (const k of ['scores', 'tldr', 'sugerencias', 'conclusiones']) if (!Array.isArray(o.visual[k])) o.visual[k] = [];
  if (!o.visual.notas) o.visual.notas = clon(VIS.notas);
  return null;
}

/* ------------------------------------------------------------------ *
 * Supuestos por defecto (los que trae el documento del estudio)
 * ------------------------------------------------------------------ */

function supBase(d) {
  return {
    usuarios: d.supuestos.usuarios,
    canales: d.supuestos.canales,
    factor: d.supuestos.factor,
    descAnual: d.supuestos.descAnual,
    gastoSuites: d.demanda.params.gastoSuites.valor,
    pymeShare: d.demanda.params.pymeShare.valor,
    segmento: d.demanda.params.segmento.valor,
    churn: d.demanda.params.churn.valor,
    margen: d.demanda.params.margen.valor,
    cac: d.demanda.params.cac.valor,
    clientes3: d.demanda.params.clientes3.valor,
  };
}

function descBase(d) {
  const o = {};
  d.planes.concat(d.kits).forEach((p) => { o[p.id] = p.desc; });
  return o;
}

function mixBase(d) {
  const o = {};
  d.demanda.mixPlan.forEach((m) => { o[m.plan.toLowerCase()] = m.peso; });
  return o;
}

// Reparto de la captación entre los tres años (misma forma que la planilla).
const COHORTES = [0.109090909090909, 0.290909090909091, 0.6];

// Paleta de series: los colores son datos, no decoración, así que están fijos.
const PAL = ['#8b5cf6', '#22d3ee', '#e879f9', '#2dd4bf', '#fb923c', '#60a5fa',
  '#f472b6', '#34d399', '#a855f7', '#06b6d4', '#fbbf24', '#f87171'];
const C = {
  violet: '#8b5cf6', cyan: '#22d3ee', fuchsia: '#e879f9', teal: '#2dd4bf',
  orange: '#fb923c', blue: '#60a5fa', green: '#34d399', red: '#fb7185',
  amber: '#fbbf24', calipso: '#06b6d4', purple: '#a855f7', pink: '#f472b6',
};

function estadoInicial(d) {
  return {
    v: 4,
    tab: 'resumen',
    tema: 'dash',
    menuTema: false,
    sup: supBase(d),
    desc: descBase(d),
    mix: mixBase(d),
    precios: {},                       // precios de competencia editados a mano
    cfg: { mods: [], desc: 0.5 },      // configurador de suscripción
    alcance: { region: '', idioma: '', prioridad: '', pais: '' },
    filtro: { q: '', app: '', seg: '', conf: '' },
    orden: { mod: { key: 'sugerido', dir: -1 }, comp: { key: 'costo', dir: -1 } },
    modSel: null,
    // rev sube en cada edición del documento: es lo que invalida los memos de
    // cálculo, porque el documento se muta en sitio y React no lo vería.
    rev: 0,
    propio: false,
    form: {
      plantilla: 'saas', empresa: '', linea: '',
      nl: { app: '', cat: '', alt: '' },
      nc: { comp: '', plan: '', precio: '', unidad: 'Plano', seg: 'PyME / Empresa', fuente: '', conf: 'Verificado', nota: '' },
    },
  };
}

/* ------------------------------------------------------------------ *
 * Motor de cálculo — las fórmulas de la planilla, en JavaScript
 * ------------------------------------------------------------------ */

function mediana(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function precioLista(c, i, precios) {
  const v = precios && precios[i];
  return typeof v === 'number' && isFinite(v) && v >= 0 ? v : c.precio;
}

/**
 * Normaliza el precio de un competidor al cliente tipo: por usuario se
 * multiplica por la dotación, por canal por los canales conectados y la tarifa
 * plana se toma tal cual. Es la única forma de comparar manzanas con manzanas.
 */
function costoTipo(c, sup, i, precios) {
  const mult = c.unidad === 'Por usuario' ? sup.usuarios : c.unidad === 'Por canal' ? sup.canales : 1;
  return precioLista(c, i, precios) * mult;
}

function calcularOferta(d, sup, desc, precios) {
  const porApp = new Map();
  d.competidores.forEach((c, i) => {
    if (!porApp.has(c.app)) porApp.set(c.app, []);
    porApp.get(c.app).push({ c: c, i: i, costo: costoTipo(c, sup, i, precios) });
  });

  const modulos = d.modulos.map((m) => {
    const rows = porApp.get(m.app) || [];
    // Los planes Enterprise se excluyen de la mediana (son otro segmento) pero
    // sí marcan el techo del mercado.
    const pyme = rows.filter((r) => r.c.seg !== 'Enterprise').map((r) => r.costo);
    const todos = rows.map((r) => r.costo);
    const med = mediana(pyme);
    const sugerido = Math.round(med * sup.factor);
    return Object.assign({}, m, {
      min: pyme.length ? Math.min.apply(null, pyme) : 0,
      med: med,
      max: todos.length ? Math.max.apply(null, todos) : 0,
      sugerido: sugerido,
      porUsuario: Math.round((sugerido / sup.usuarios) * 10) / 10,
      ahorro: med ? 1 - sugerido / med : 0,
      planes: rows.length,
      verificados: rows.filter((r) => r.c.conf === 'Verificado').length,
    });
  });

  const byN = new Map(modulos.map((m) => [m.n, m]));
  const byApp = new Map(modulos.map((m) => [m.app, m]));
  const armar = (p) => {
    const suma = p.mods.reduce((a, n) => a + byN.get(n).sugerido, 0);
    const dsc = desc[p.id] != null ? desc[p.id] : p.desc;
    const mensual = Math.round(suma * (1 - dsc));
    const anual = Math.round(mensual * 12 * (1 - sup.descAnual));
    return Object.assign({}, p, {
      suma: suma,
      descuento: dsc,
      mensual: mensual,
      porUsuario: Math.round((mensual / sup.usuarios) * 10) / 10,
      anual: anual,
      ahorroAnual: suma * 12 - anual,
      nombres: p.mods.map((n) => byN.get(n).app),
    });
  };

  const planes = d.planes.map(armar);
  const kits = d.kits.map(armar);

  const stack = d.stack.map((s) => {
    const c = d.competidores[s.comp];
    return {
      necesidad: s.necesidad, herramienta: s.herramienta, plan: s.plan, app: c.app,
      unidad: c.unidad, costo: costoTipo(c, sup, s.comp, precios),
    };
  });
  const stackTotal = stack.reduce((a, s) => a + s.costo, 0);
  // Un estudio recién creado todavía no tiene planes: el plan tope es un cero
  // con forma de plan para que nada más abajo tenga que preguntar.
  const PLAN_CERO = { id: '', nombre: '—', suma: 0, descuento: 0, mensual: 0, porUsuario: 0, anual: 0, ahorroAnual: 0, mods: [], nombres: [] };
  const ent = planes[planes.length - 1] || PLAN_CERO;

  const medianaCartera = mediana(modulos.map((m) => m.med));
  modulos.forEach((m) => {
    const paga = m.med >= medianaCartera;
    const ventaja = m.ventaja >= 5.5;
    m.cuadrante = paga && ventaja ? 'APOSTAR'
      : paga && !ventaja ? 'MONETIZAR CON CUIDADO'
      : ventaja ? 'DIFERENCIAR, NO FACTURAR' : 'REPLANTEAR';
  });

  return {
    modulos: modulos, byN: byN, byApp: byApp, planes: planes, kits: kits, planCero: PLAN_CERO,
    aLaCarta: modulos.reduce((a, m) => a + m.sugerido, 0),
    medianaTotal: modulos.reduce((a, m) => a + m.med, 0),
    medianaCartera: medianaCartera,
    stack: stack,
    stackTotal: stackTotal,
    stackPorUsuario: stackTotal / sup.usuarios,
    ratioStack: stackTotal ? ent.mensual / stackTotal : 0,
    ahorroAnualStack: (stackTotal - ent.mensual) * 12,
    verificados: d.competidores.filter((c) => c.conf === 'Verificado').length,
  };
}

function paisesEnAlcance(d, alcance) {
  return d.demanda.paises.filter((p) => {
    if (alcance.pais && p.pais !== alcance.pais) return false;
    if (alcance.region && p.region !== alcance.region) return false;
    if (alcance.idioma && p.idioma !== alcance.idioma) return false;
    if (alcance.prioridad && p.prioridad !== alcance.prioridad) return false;
    return true;
  });
}

function calcularDemanda(d, sup, alcance, oferta, mix) {
  const saasReg = new Map(d.demanda.regiones.map((r) => [r.region, r.saas]));
  const filas = paisesEnAlcance(d, alcance).map((p) => {
    const saas = p.peso * (saasReg.get(p.region) || 0);
    const tam = saas * sup.gastoSuites * sup.pymeShare;
    const sam = tam * sup.segmento * p.cobertura;
    return Object.assign({}, p, { saas: saas, tam: tam, sam: sam });
  });

  const mercado = filas.reduce((a, f) => a + f.saas, 0);
  const tam = filas.reduce((a, f) => a + f.tam, 0);
  const sam = filas.reduce((a, f) => a + f.sam, 0);
  // El índice del alcance se pondera por SAM: un país chico no mueve la aguja.
  const indice = sam ? filas.reduce((a, f) => a + f.sam * f.indice, 0) / sam : 0;

  const precio = (id) => {
    const p = oferta.planes.filter((x) => x.id === id)[0];
    return p ? p.mensual : 0;
  };
  const arpuMensual = (mix.starter || 0) * precio('starter')
    + (mix.business || 0) * precio('business')
    + (mix.enterprise || 0) * precio('enterprise');
  const arpuAnualBase = arpuMensual * 12;
  const arpuAnual = arpuAnualBase * indice;

  // Supervivencia por cohorte: cada año se capta repartido en 12 meses y se le
  // aplica (1-churn)^meses. Sin esto el churn no tocaría el ARR.
  const ch = sup.churn;
  const factorAnual = ch === 0 ? 12 : (1 - Math.pow(1 - ch, 12)) / ch;
  const cohortes = COHORTES.map((w, i) => {
    const nuevos = sup.clientes3 * w;
    const vivos = [0, 1, 2].map((anio) => (anio < i ? 0
      : (nuevos / 12) * Math.pow(1 - ch, 12 * (anio - i)) * factorAnual));
    return { anio: i + 1, nuevos: nuevos, vivos: vivos };
  });
  const vivos = [0, 1, 2].map((i) => cohortes.reduce((a, c) => a + c.vivos[i], 0));
  const arr = vivos.map((v) => Math.round(v * arpuAnual));

  const ltv = (arpuAnual / 12) * sup.margen * (ch ? 1 / ch : 0);
  const payback = arpuAnual ? sup.cac / ((arpuAnual / 12) * sup.margen) : 0;
  const penetracion = sam ? arr[2] / (sam * 1e6) : 0;

  return {
    filas: filas, mercado: mercado, tam: tam, sam: sam, indice: indice,
    arpuMensual: arpuMensual, arpuAnualBase: arpuAnualBase, arpuAnual: arpuAnual,
    cohortes: cohortes, vivos: vivos.map((v) => Math.round(v)), arr: arr,
    vidaMedia: ch ? 1 / ch : 0, ltv: ltv, ratio: sup.cac ? ltv / sup.cac : 0,
    payback: payback, penetracion: penetracion,
    retencion: sup.clientes3 ? vivos[2] / sup.clientes3 : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Formato
 * ------------------------------------------------------------------ */

// El modo dashboard replica el formato del tablero original (1,234.5); los
// demás usan el formato local (1.234,5). Es lo único que cambia entre modos
// además de la escala visual.
let LOC = 'en-US';
const nf = {};
const fmt = (d) => (nf[LOC + '|' + d] || (nf[LOC + '|' + d] = new Intl.NumberFormat(LOC, {
  minimumFractionDigits: d, maximumFractionDigits: d,
})));
const setLocale = (tema) => { LOC = tema === 'dash' ? 'en-US' : 'es-CL'; };

const usd = (n) => '$' + fmt(0).format(Math.round(n || 0));
const usd1 = (n) => '$' + fmt(1).format(n || 0);
const mm = (n) => '$' + fmt(0).format(Math.round(n || 0)) + ' MM';
const pct = (n, d) => fmt(d == null ? 1 : d).format((n || 0) * 100) + '%';
const x1 = (n) => fmt(1).format(n || 0);
const x2 = (n) => fmt(2).format(n || 0);          // índice de precio y factor: 0,91 no es 0,9
const num = (n) => fmt(0).format(Math.round(n || 0));
const corto = (s) => String(s).split(' (')[0];

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  // El documento del estudio vive en la instancia, no en el módulo: dos
  // ventanas abiertas pueden estar analizando dos empresas distintas.
  let D = docSemilla();
  let estado = estadoInicial(D);
  const oyentes = new Set();

  function commit(patch) {
    estado = Object.assign({}, estado, patch);
    oyentes.forEach((f) => f(estado));
    programarGuardado();
  }
  function setSup(k, v) {
    const n = Number(v);
    if (!isFinite(n)) return;
    commit({ sup: Object.assign({}, estado.sup, { [k]: n }) });
  }
  function setDesc(id, v) {
    const n = Number(v);
    if (!isFinite(n)) return;
    commit({ desc: Object.assign({}, estado.desc, { [id]: Math.min(0.95, Math.max(0, n)) }) });
  }
  function setMix(k, v) {
    const n = Number(v);
    if (!isFinite(n)) return;
    commit({ mix: Object.assign({}, estado.mix, { [k]: Math.min(1, Math.max(0, n)) }) });
  }
  function setPrecio(i, v) {
    const n = Number(v);
    const p = Object.assign({}, estado.precios);
    if (!isFinite(n) || n < 0 || v === '') delete p[i]; else p[i] = n;
    commit({ precios: p });
  }
  function setAlcance(k, v) {
    const a = Object.assign({}, estado.alcance, { [k]: v });
    // Elegir un país manda sobre los filtros de grupo: si no, se contradicen.
    if (k === 'pais' && v) { a.region = ''; a.idioma = ''; a.prioridad = ''; }
    if (k !== 'pais') a.pais = '';
    commit({ alcance: a });
  }
  function setFiltro(k, v) { commit({ filtro: Object.assign({}, estado.filtro, { [k]: v }) }); }
  function setOrden(tabla, key) {
    const o = estado.orden[tabla];
    const dir = o.key === key ? -o.dir : -1;
    commit({ orden: Object.assign({}, estado.orden, { [tabla]: { key: key, dir: dir } }) });
  }
  function toggleMod(app) {
    const s = estado.cfg.mods.slice();
    const i = s.indexOf(app);
    if (i >= 0) s.splice(i, 1); else s.push(app);
    commit({ cfg: Object.assign({}, estado.cfg, { mods: s }) });
  }
  function setPreset(id) {
    if (id === '__todos') return commit({ cfg: { mods: D.modulos.map((m) => m.app), desc: 0.62 } });
    if (id === '__ninguno') return commit({ cfg: { mods: [], desc: estado.cfg.desc } });
    const p = D.planes.concat(D.kits).filter((x) => x.id === id)[0];
    if (!p) return;
    const byN = new Map(D.modulos.map((m) => [m.n, m.app]));
    commit({ cfg: { mods: p.mods.map((n) => byN.get(n)), desc: estado.desc[p.id] != null ? estado.desc[p.id] : p.desc } });
  }

  /* --------------------- el estudio como documento ---------------------- */

  // El documento se muta en sitio (es grande y se edita fila a fila); lo que
  // dispara el redibujo es la revisión, no una copia nueva del objeto.
  function tocarDoc(patch) {
    commit(Object.assign({ rev: (estado.rev || 0) + 1, propio: true }, patch || {}));
  }

  function setForm(k, v) { commit({ form: Object.assign({}, estado.form, { [k]: v }) }); }
  function setSubForm(grupo, k, v) {
    setForm(grupo, Object.assign({}, estado.form[grupo], { [k]: v }));
  }

  function cargarDoc(nuevo, aviso, propio) {
    D = nuevo;
    const base = estadoInicial(D);
    estado = Object.assign(base, {
      tema: estado.tema, tab: 'estudio', rev: (estado.rev || 0) + 1,
      propio: propio !== false, form: estado.form,
    });
    oyentes.forEach((f) => f(estado));
    programarGuardado();
    if (aviso && shell && shell.notify) shell.notify({ level: 'success', text: aviso });
  }

  function nuevoEstudio(plantilla, empresa) {
    const t = PLANTILLAS.filter((x) => x.id === plantilla)[0];
    cargarDoc(docPlantilla(plantilla, empresa),
      'Estudio nuevo con la plantilla ' + (t ? t.nombre : plantilla) + '. No trae ni un precio: eso lo pone la investigación.');
  }

  function volverASemilla() {
    cargarDoc(docSemilla(), 'Volviste al estudio de KIMOS', false);
  }

  function setMeta(k, v) {
    D.meta = Object.assign({}, D.meta, { [k]: v });
    tocarDoc();
  }

  function agregarLinea(o) {
    const app = String(o.app || '').trim();
    if (!app) return 'Ponle nombre a la línea.';
    if (D.modulos.some((m) => m.app.toLowerCase() === app.toLowerCase())) return 'Ya existe una línea llamada ' + app + '.';
    const n = D.modulos.reduce((a, m) => Math.max(a, m.n), 0) + 1;
    D.modulos = D.modulos.concat([{
      n: n, app: app, que: o.que || '', cat: o.cat || '', alt: o.alt || '',
      target: '', pro: '', contra: '', estrategia: '', conf: '0/0',
      ventaja: typeof o.ventaja === 'number' ? o.ventaja : 5, icono: o.icono || 'target',
    }]);
    tocarDoc();
    return null;
  }

  function editarLinea(app, k, v) {
    D.modulos = D.modulos.map((m) => (m.app === app ? Object.assign({}, m, { [k]: v }) : m));
    // Renombrar una línea tiene que arrastrar sus precios, o quedan huérfanos.
    if (k === 'app') D.competidores = D.competidores.map((c) => (c.app === app ? Object.assign({}, c, { app: v }) : c));
    tocarDoc();
  }

  function borrarLinea(app) {
    const m = D.modulos.filter((x) => x.app === app)[0];
    if (!m) return;
    D.modulos = D.modulos.filter((x) => x.app !== app);
    D.competidores = D.competidores.filter((c) => c.app !== app);
    D.planes = D.planes.map((p) => Object.assign({}, p, { mods: p.mods.filter((n) => n !== m.n) }));
    D.kits = D.kits.map((p) => Object.assign({}, p, { mods: p.mods.filter((n) => n !== m.n) }));
    D.stack = D.stack.filter((x) => (D.competidores[x.comp] || {}).app !== app);
    tocarDoc({ modSel: null, precios: {} });
  }

  const UNIDADES = ['Plano', 'Por usuario', 'Por canal'];
  const SEGMENTOS = ['PyME / Empresa', 'Enterprise'];

  function agregarCompetidor(o) {
    const app = String(o.app || '').trim();
    if (!D.modulos.some((m) => m.app === app)) return 'No existe la línea ' + app + '.';
    if (!String(o.comp || '').trim()) return 'Falta el nombre del competidor.';
    if (!String(o.plan || '').trim()) return 'Falta el nombre del plan.';
    const precio = Number(o.precio);
    if (!isFinite(precio) || precio < 0) return 'El precio tiene que ser un número mayor o igual que cero.';
    if (!String(o.fuente || '').trim()) return 'Sin fuente no entra: es la regla del estudio.';
    if (UNIDADES.indexOf(o.unidad) < 0) return 'Unidad desconocida. Usa: ' + UNIDADES.join(', ') + '.';
    if (SEGMENTOS.indexOf(o.seg) < 0) return 'Segmento desconocido. Usa: ' + SEGMENTOS.join(', ') + '.';
    D.competidores = D.competidores.concat([{
      row: D.competidores.length, app: app, comp: String(o.comp).trim(), plan: String(o.plan).trim(),
      precio: precio, unidad: o.unidad, seg: o.seg, nota: o.nota || '',
      fuente: String(o.fuente).trim(), conf: o.conf === 'Estimado' ? 'Estimado' : 'Verificado',
    }]);
    tocarDoc({ precios: {} });
    return null;
  }

  function borrarCompetidor(i) {
    if (!D.competidores[i]) return;
    D.competidores = D.competidores.filter((c, k) => k !== i);
    // stack guarda índices sobre competidores: se recolocan o el stack miente.
    D.stack = D.stack.filter((x) => x.comp !== i).map((x) => (x.comp > i ? Object.assign({}, x, { comp: x.comp - 1 }) : x));
    tocarDoc({ precios: {} });
  }

  /** Lo que le falta a este estudio para poder decidir con él. */
  function huecos() {
    const hs = [];
    const sinPrecio = D.modulos.filter((m) => !D.competidores.some((c) => c.app === m.app));
    if (!D.meta.empresa) hs.push('El estudio no dice de qué empresa es.');
    if (!D.meta.rubro) hs.push('Falta declarar el rubro.');
    if (!D.competidores.length) hs.push('No hay ni un precio de competencia levantado.');
    else if (sinPrecio.length) hs.push(sinPrecio.length + ' línea(s) sin competencia levantada: ' + sinPrecio.map((m) => m.app).join(', ') + '.');
    const sinFuente = D.competidores.filter((c) => !c.fuente).length;
    if (sinFuente) hs.push(sinFuente + ' precio(s) sin fuente.');
    if (!D.demanda.paises.length) hs.push('El estudio de demanda está vacío: sin mercados no hay TAM ni SAM.');
    if (!D.evidencia.length) hs.push('No hay evidencia de demanda cargada.');
    if (!D.icp.length) hs.push('No hay perfiles de cliente ideal.');
    const meses = edadMeses();
    if (meses != null && meses >= 12) hs.push('El levantamiento tiene ' + meses + ' meses: ya no sirve para decidir precio.');
    else if (meses != null && meses >= 6) hs.push('El levantamiento tiene ' + meses + ' meses: toca revisarlo.');
    if (!D.visual.scores.length) hs.push('Falta el diagnóstico por dimensión.');
    return hs;
  }

  function edadMeses() {
    const f = Date.parse(D.meta.fecha);
    if (!isFinite(f)) return null;
    return Math.max(0, Math.round((Date.now() - f) / (1000 * 60 * 60 * 24 * 30.4)));
  }

  let timer = null;
  function programarGuardado() {
    if (!shell || typeof shell.saveData !== 'function') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { v, tab, tema, sup, desc, mix, precios, cfg, alcance, propio } = estado;
      // El documento solo se guarda si es propio: mientras sea el estudio de
      // KIMOS tal cual, ya viene en el bundle y guardarlo sería duplicarlo.
      const payload = { v, tab, tema, sup, desc, mix, precios, cfg, alcance, propio };
      if (propio) payload.doc = D;
      Promise.resolve(shell.saveData(payload)).catch(() => {});
    }, 800);
  }

  async function restaurar() {
    if (!shell || typeof shell.loadData !== 'function') return;
    try {
      const d = await shell.loadData();
      if (!d || typeof d !== 'object') return;
      if (d.propio && d.doc && !validarDoc(d.doc)) {
        D = d.doc;
        estado = Object.assign(estadoInicial(D), { tema: estado.tema, propio: true });
      }
      const patch = {};
      if (d.tab) patch.tab = d.tab;
      if (d.tema) patch.tema = d.tema;
      if (d.sup) patch.sup = Object.assign(supBase(D), d.sup);
      if (d.desc) patch.desc = Object.assign(descBase(D), d.desc);
      if (d.mix) patch.mix = Object.assign(mixBase(D), d.mix);
      if (d.precios) patch.precios = d.precios;
      if (d.cfg && Array.isArray(d.cfg.mods)) patch.cfg = d.cfg;
      if (d.alcance) patch.alcance = Object.assign({ region: '', idioma: '', prioridad: '', pais: '' }, d.alcance);
      estado = Object.assign({}, estado, patch);
      oyentes.forEach((f) => f(estado));
    } catch (e) { /* primera apertura: sin datos guardados */ }
  }

  function descargar(nombre, texto, tipo) {
    try {
      // El BOM es para que Excel abra bien el CSV; en JSON rompería el parseo.
      const json = tipo === 'json';
      const blob = new Blob([(json ? '' : '﻿') + texto],
        { type: (json ? 'application/json' : 'text/csv') + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Exportado ' + nombre });
    } catch (e) {
      if (shell && shell.notify) shell.notify({ level: 'error', text: 'No se pudo exportar' });
    }
  }

  function exportarEstudio() {
    const nom = (D.meta.empresa || 'estudio').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'estudio';
    descargar(nom + '-estudio-mercado.json', JSON.stringify(D, null, 1), 'json');
  }

  function importarEstudio(texto) {
    let o;
    try { o = JSON.parse(texto); } catch (e) { return 'El archivo no es JSON válido.'; }
    const err = validarDoc(o);
    if (err) return err;
    cargarDoc(o, 'Estudio importado: ' + (o.meta.empresa || 'sin nombre'));
    return null;
  }

  const csv = (filas) => filas
    .map((f) => f.map((c) => {
      const s = c == null ? '' : String(c);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';'))
    .join('\n');

  function exportar(oferta, demanda) {
    if (estado.tab === 'competencia') {
      const cab = ['App KIMOS', 'Competidor', 'Plan', 'Precio USD/mes', 'Unidad', 'Costo cliente tipo', 'Segmento', 'Notas', 'Fuente', 'Confianza'];
      const filas = D.competidores.map((c, i) => [c.app, c.comp, c.plan, precioLista(c, i, estado.precios),
        c.unidad, Math.round(costoTipo(c, estado.sup, i, estado.precios)), c.seg, c.nota, c.fuente, c.conf]);
      return descargar('kimos-competencia.csv', csv([cab].concat(filas)));
    }
    if (estado.tab === 'mercados') {
      const cab = ['País', 'Región', 'Idioma', 'Prioridad', 'Cobertura', 'Mercado SaaS USD MM', 'TAM USD MM', 'SAM USD MM', 'Índice precio', 'Starter', 'Business', 'Enterprise'];
      const pl = (id, ix) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || { mensual: 0 }).mensual * ix);
      const filas = demanda.filas.map((f) => [f.pais, f.region, f.idioma, f.prioridad, f.cobertura,
        Math.round(f.saas), Math.round(f.tam), Math.round(f.sam), f.indice,
        pl('starter', f.indice), pl('business', f.indice), pl('enterprise', f.indice)]);
      return descargar('kimos-mercados.csv', csv([cab].concat(filas)));
    }
    const cab = ['#', 'App KIMOS', 'Categoría', 'Alternativas', 'Mín', 'Mediana', 'Máx', 'Precio sugerido', 'Por usuario', 'Ahorro vs mediana', 'Cuadrante', 'Estrategia'];
    const filas = oferta.modulos.map((m) => [m.n, m.app, m.cat, m.alt, Math.round(m.min), Math.round(m.med),
      Math.round(m.max), m.sugerido, m.porUsuario, pct(m.ahorro, 0), m.cuadrante, m.estrategia]);
    return descargar('kimos-modulos.csv', csv([cab].concat(filas)));
  }

  /* ---------------------------- piezas de UI ---------------------------- */

  // Texto del estudio con <b> y marcadores {clave} que se rellenan en vivo.
  function rt(texto, vals) {
    const t = String(texto).replace(/\{(\w+)\}/g, (m, k) => (vals && vals[k] != null ? vals[k] : m));
    return t.split(/(<b>[\s\S]*?<\/b>)/g).map((p, i) => (p.indexOf('<b>') === 0
      ? h('b', { key: i }, p.slice(3, -4))
      : p));
  }

  const card = (titulo, color, hint, cuerpo, extra) => h('section',
    Object.assign({ className: 'km-card' }, extra || {}),
    h('h2', null, h('span', { className: 'km-dot', style: { '--k-g': color } }), titulo),
    hint ? h('p', { className: 'km-hint' }, hint) : null,
    h('div', { className: 'km-card-body' }, cuerpo));

  const kpi = (k, v, n, color) => h('div', { className: 'km-kpi', key: k, style: { '--k-g': color } },
    h('div', { className: 'km-kpi-k' }, k),
    h('div', { className: 'km-kpi-v' }, v),
    n ? h('div', { className: 'km-kpi-n' }, n) : null);

  const nota = (n) => h('div', { className: 'km-note' }, h('b', null, n.titulo + ' '), n.texto);

  const qline = (etiqueta, valor, color) => h('div', { className: 'km-qline', key: etiqueta },
    h('span', null, etiqueta), h('b', { style: color ? { color: color } : null }, valor));

  const pill = (texto, clase) => h('span', { className: 'km-pill ' + clase }, texto);
  const pillConf = (c) => pill(c, c === 'Verificado' ? 'km-p-ok' : 'km-p-est');
  const CLASE_CUAD = {
    'APOSTAR': 'km-p-g', 'MONETIZAR CON CUIDADO': 'km-p-o',
    'DIFERENCIAR, NO FACTURAR': 'km-p-c', 'REPLANTEAR': 'km-p-r',
  };
  const CLASE_PRIO = {
    'Prioritario': 'km-p-g', 'Expansión': 'km-p-c', 'Oportunista': 'km-p-o', 'No perseguir': 'km-p-v',
  };

  const icono = (m, i) => h('div', {
    className: 'km-ico',
    style: { '--k-c1': PAL[i % PAL.length], '--k-c2': PAL[(i + 4) % PAL.length] },
  }, h('svg', {
    viewBox: '0 0 24 24',
    dangerouslySetInnerHTML: { __html: PATHS[m.icono] || PATHS.box },
  }));

  /** Tabla genérica: cols = [{ k, l, num, sort, cell }]. Evita anidar 8 niveles. */
  function tabla(cols, filas, opts) {
    const o = opts || {};
    const th = cols.map((c) => h('th', {
      key: c.k,
      className: (c.num ? 'km-num ' : '') + (c.sort ? 'km-sort' : '') + (o.orden && o.orden.key === c.k ? ' on' : ''),
      onClick: c.sort && o.onSort ? () => o.onSort(c.k) : undefined,
    }, c.l, o.orden && o.orden.key === c.k ? (o.orden.dir < 0 ? ' ▼' : ' ▲') : ''));

    const tr = filas.map((f, i) => h('tr', {
      key: o.key ? o.key(f, i) : i,
      className: o.clase ? o.clase(f) : undefined,
      onClick: o.onClick ? () => o.onClick(f) : undefined,
      title: o.title ? o.title(f) : undefined,
    }, cols.map((c) => h('td', { key: c.k, className: c.num ? 'km-num' : undefined }, c.cell(f, i)))));

    return h('div', { className: 'km-tbl-wrap' },
      h('table', { className: 'km-tbl' },
        h('thead', null, h('tr', null, th)),
        h('tbody', null, tr.concat(o.pie || []))));
  }

  const filaTotal = (celdas) => h('tr', { className: 'km-tot', key: 'tot' },
    celdas.map((c, i) => h('td', { key: i, className: c.num ? 'km-num' : undefined, colSpan: c.span }, c.v)));

  /* -------------------------------- gráficos ------------------------------ */

  /** Barras horizontales agrupadas: filas = [{ label, a, b }]. */
  function barrasDobles(filas, colorA, colorB, etiquetaA, etiquetaB) {
    const W = 720, LB = 168, PAD = 56, alto = 20;
    const H = filas.length * alto + 16;
    const max = Math.max.apply(null, filas.map((f) => Math.max(f.a, f.b)).concat([1]));
    const esc = (v) => (v / max) * (W - LB - PAD);
    const cuerpo = filas.map((f, i) => h('g', { key: f.label, transform: 'translate(0,' + (i * alto + 10) + ')' },
      h('text', { x: LB - 8, y: 4, textAnchor: 'end', className: 'km-lbl' }, corto(f.label)),
      h('rect', { x: LB, y: -5, width: Math.max(1, esc(f.a)), height: 6, rx: 3, fill: colorA, opacity: .85 }),
      h('rect', { x: LB, y: 2, width: Math.max(1, esc(f.b)), height: 6, rx: 3, fill: colorB }),
      h('title', null, corto(f.label) + ' — ' + etiquetaA + ' ' + usd(f.a) + ' · ' + etiquetaB + ' ' + usd(f.b)),
      h('text', { x: LB + Math.max(esc(f.a), esc(f.b)) + 6, y: 4, className: 'km-val' }, usd(f.b))));

    return h('div', null,
      h('div', { className: 'km-leyenda' },
        h('span', null, h('i', { style: { background: colorA } }), etiquetaA),
        h('span', null, h('i', { style: { background: colorB } }), etiquetaB)),
      h('div', { className: 'km-chart-wrap' },
        h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '600px' } },
          h('line', { x1: LB, y1: 2, x2: LB, y2: H - 6, className: 'km-ax' }),
          cuerpo)));
  }

  /** Dona con leyenda: partes = [{ label, valor }]. */
  function dona(partes, total) {
    const R = 54, GR = 26, CIRC = 2 * Math.PI * R;
    let acum = 0;
    const arcos = partes.map((p, i) => {
      const frac = total ? p.valor / total : 0;
      const el = h('circle', {
        key: p.label, cx: 70, cy: 70, r: R, fill: 'none',
        stroke: PAL[i % PAL.length], strokeWidth: GR,
        strokeDasharray: (frac * CIRC) + ' ' + CIRC,
        strokeDashoffset: -acum * CIRC,
        transform: 'rotate(-90 70 70)',
      }, h('title', null, p.label + ' — ' + usd(p.valor) + ' (' + pct(frac, 0) + ')'));
      acum += frac;
      return el;
    });
    const leyenda = partes.map((p, i) => h('span', { key: p.label },
      h('i', { style: { background: PAL[i % PAL.length] } }),
      p.label, h('b', null, usd(p.valor))));

    return h('div', { className: 'km-dona-row' },
      h('svg', { viewBox: '0 0 140 140', className: 'km-chart', style: { width: '150px', flex: 'none' } },
        h('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: 'rgba(255,255,255,.06)', strokeWidth: GR }),
        arcos,
        h('text', { x: 70, y: 68, textAnchor: 'middle', className: 'km-lbl', style: { fontSize: '15px', fontWeight: 700 } }, usd(total)),
        h('text', { x: 70, y: 82, textAnchor: 'middle', style: { fontSize: '9px' } }, 'al mes')),
      h('div', { className: 'km-dona-leg', style: { flex: 1, minWidth: '180px' } }, leyenda));
  }

  /** Barras verticales: filas = [{ label, valor, color }]. */
  function barrasVert(filas, formato) {
    const W = 520, H = 200, BASE = H - 26, TOP = 16;
    const max = Math.max.apply(null, filas.map((f) => f.valor).concat([1]));
    const ancho = W / filas.length;
    const cuerpo = filas.map((f, i) => {
      const alto = Math.max(2, ((f.valor / max) * (BASE - TOP)));
      const x = i * ancho + ancho * 0.22;
      const w = ancho * 0.56;
      return h('g', { key: f.label },
        h('rect', { x: x, y: BASE - alto, width: w, height: alto, rx: 5, fill: f.color, opacity: .9 },
          h('title', null, f.label + ' — ' + formato(f.valor))),
        h('text', { x: x + w / 2, y: BASE - alto - 5, textAnchor: 'middle', className: 'km-val' }, formato(f.valor)),
        h('text', { x: x + w / 2, y: BASE + 15, textAnchor: 'middle', className: 'km-lbl' }, f.label));
    });
    return h('div', { className: 'km-chart-wrap' },
      h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '420px' } },
        h('line', { x1: 0, y1: BASE, x2: W, y2: BASE, className: 'km-ax' }),
        cuerpo));
  }

  /** Barras horizontales simples: filas = [{ label, valor, nota }]. */
  function barrasSimples(filas, color, formato) {
    const col = (i) => (typeof color === 'function' ? color(i) : color);
    const W = 700, LB = 150, PAD = 74, alto = 19;
    const H = filas.length * alto + 10;
    const max = Math.max.apply(null, filas.map((f) => f.valor).concat([1]));
    const cuerpo = filas.map((f, i) => h('g', { key: f.label, transform: 'translate(0,' + (i * alto + 8) + ')' },
      h('text', { x: LB - 8, y: 4, textAnchor: 'end', className: 'km-lbl' }, corto(f.label)),
      h('rect', {
        x: LB, y: -5, height: 10, rx: 5, fill: col(i), opacity: .85,
        width: Math.max(1, (f.valor / max) * (W - LB - PAD)),
      }, h('title', null, f.label + ' — ' + formato(f.valor) + (f.nota ? ' · ' + f.nota : ''))),
      h('text', { x: LB + (f.valor / max) * (W - LB - PAD) + 6, y: 4, className: 'km-val' }, formato(f.valor))));
    return h('div', { className: 'km-chart-wrap' },
      h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '560px' } },
        h('line', { x1: LB, y1: 0, x2: LB, y2: H - 4, className: 'km-ax' }),
        cuerpo));
  }

  /* ------------------------------- pestañas ------------------------------ */

  // Tres modos visuales. El dashboard es el que replica el tablero del estudio.
  const TEMAS = [
    ['dash', 'Modo dashboard', '▦', 'La estética del tablero del estudio, tal cual'],
    ['estudio', 'Modo compacto', '▤', 'Lo mismo, con menos aire: ventanas chicas'],
    ['host', 'Modo KIMOS', '◐', 'Sigue el día/noche y el acento del escritorio'],
  ];

  const TABS = [
    ['resumen', 'Resumen', '◎'],
    ['mapa', 'Mapa competitivo', '▤'],
    ['competencia', 'Precios por app', '⑈'],
    ['planes', 'Planes y kits', '▥'],
    ['configurador', 'Configurador', '⚙'],
    ['mercados', 'Mercados', '🌎'],
    ['economia', 'Economía', '📈'],
    ['clientes', 'Clientes', '👥'],
    ['proscontras', 'Pros y contras', '⇆'],
    ['diagnostico', 'Diagnóstico', '⚑'],
    ['estudio', 'Este estudio', '◈'],
  ];

  function valsTexto(oferta) {
    const ent = oferta.planes[oferta.planes.length - 1] || oferta.planCero;
    const kits = oferta.kits.map((k) => k.mensual);
    const top3 = oferta.modulos.slice().sort((a, b) => b.sugerido - a.sugerido).slice(0, 3)
      .map((m) => corto(m.app)).join(', ');
    return {
      stack: usd(oferta.stackTotal), aLaCarta: usd(oferta.aLaCarta), enterprise: usd(ent.mensual),
      ahorroAnual: usd(oferta.ahorroAnualStack), top3: top3,
      kitMin: usd(kits.length ? Math.min.apply(null, kits) : 0),
      kitMax: usd(kits.length ? Math.max.apply(null, kits) : 0),
      estimados: String(D.competidores.length - oferta.verificados),
      totalPlanes: String(D.competidores.length),
    };
  }

  const tarjetaDiag = (t, vals) => h('div', { className: 'km-diag', key: t.titulo, style: { '--k-g': C[t.color] || C.violet } },
    h('h4', null, t.titulo),
    h('p', null, rt(t.texto, vals)));

  /**
   * Pestaña "Este estudio": lo que convierte el tablero de KIMOS en una
   * herramienta que sirve para cualquier empresa. Aquí se declara de quién es
   * el estudio, se ve qué le falta, se arranca uno nuevo con la plantilla del
   * rubro, se importa y exporta, y se editan las líneas y los precios.
   */
  function vistaEstudio() {
    const meta = D.meta || {};
    const plant = PLANTILLAS.filter((x) => x.id === meta.plantilla)[0];
    const meses = edadMeses();
    const hs = huecos();
    const verif = D.competidores.filter((c) => c.conf === 'Verificado').length;
    const cobertura = D.competidores.length ? verif / D.competidores.length : 0;
    const conLinea = D.modulos.filter((m) => D.competidores.some((c) => c.app === m.app)).length;
    const f = estado.form;
    const avisar = (nivel, texto) => { if (shell && shell.notify) shell.notify({ level: nivel, text: texto }); };

    const campo = (etiqueta, valor, onChange, ph) => h('div', { className: 'km-ctrl', key: etiqueta },
      h('label', null, etiqueta),
      h('input', {
        className: 'km-in', type: 'text', value: valor || '', placeholder: ph || '',
        onChange: (e) => onChange(e.target.value),
      }));

    /* ------------------------------ identidad ----------------------------- */
    const identidad = card('Identidad del estudio', C.violet,
      'De qué empresa es, quién lo firma y cuándo se levantó. Todo lo demás se lee a la luz de esto.',
      h('div', null,
        h('div', { className: 'km-ctrls' },
          campo('Empresa analizada', meta.empresa, (v) => setMeta('empresa', v), 'Nombre de la empresa'),
          campo('Rubro', meta.rubro, (v) => setMeta('rubro', v), 'Sector o industria'),
          campo('Autor', meta.autor, (v) => setMeta('autor', v), 'Quién hizo el estudio'),
          campo('Moneda', meta.moneda, (v) => setMeta('moneda', v), 'USD'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Fecha del levantamiento'),
            h('input', {
              className: 'km-in', type: 'date', value: meta.fecha || '',
              onChange: (e) => setMeta('fecha', e.target.value),
            })),
          campo('Título', meta.titulo, (v) => setMeta('titulo', v), 'Estudio de Mercado y Modelo de Precios')),
        h('div', { className: 'km-filtros' },
          pill('Plantilla: ' + (plant ? plant.nombre : 'estudio original'), 'km-p-v'),
          pill(estado.propio ? 'Documento propio de esta ventana' : 'Estudio de KIMOS (semilla del bundle)',
            estado.propio ? 'km-p-g' : 'km-p-c'),
          pill(D.modulos.length + ' líneas · ' + D.competidores.length + ' precios levantados', 'km-p-c'))));

    /* -------------------------- salud de la evidencia --------------------- */
    const colorEdad = meses == null ? C.violet : meses >= 12 ? C.red : meses >= 6 ? C.amber : C.green;
    const salud = card('Qué tan sólido está', colorEdad,
      'Un estudio de precios envejece: a los seis meses hay que revisarlo y a los doce ya no sirve para decidir.',
      h('div', null,
        h('div', { className: 'km-kpis' },
          kpi('Precios levantados', num(D.competidores.length), verif + ' verificados en fuente', C.cyan),
          kpi('Cobertura de fuente', D.competidores.length ? pct(cobertura, 0) : '—',
            (D.competidores.length - verif) + ' estimados', cobertura >= 0.8 ? C.green : C.amber),
          kpi('Líneas con competencia', conLinea + '/' + D.modulos.length,
            conLinea === D.modulos.length ? 'Todas cubiertas' : 'Faltan por levantar', conLinea === D.modulos.length ? C.green : C.orange),
          kpi('Edad del levantamiento', meses == null ? '—' : meses + (meses === 1 ? ' mes' : ' meses'),
            meses == null ? 'Sin fecha' : meses >= 12 ? 'Vencido' : meses >= 6 ? 'Toca revisarlo' : 'Vigente', colorEdad)),
        hs.length
          ? h('div', { className: 'km-col' },
            h('h4', null, 'Lo que le falta a este estudio'),
            h('ul', { className: 'km-mut km-lista' }, hs.map((x, i) => h('li', { key: i }, x))))
          : nota({ titulo: 'Sin huecos.', texto: 'El estudio tiene identidad, precios con fuente, mercados y perfiles de cliente. Se puede decidir con él.' })));

    /* ------------------------------ plantillas ---------------------------- */
    const plantillas = card('Empezar el estudio de otra empresa', C.cyan,
      'La plantilla trae la estructura de comparación del rubro y las fuentes que sirven en ese sector. No trae cifras: los números los pone la investigación.',
      h('div', null,
        h('div', { className: 'km-modgrid' }, PLANTILLAS.map((x) => h('button', {
          key: x.id, className: 'km-mod' + (f.plantilla === x.id ? ' on' : ''),
          title: x.rubro || 'Sin estructura previa',
          onClick: () => setForm('plantilla', x.id),
        }, h('span', null, x.nombre), h('span', { className: 'km-mod-pz' }, x.icono)))),
        h('div', { className: 'km-ctrls' },
          campo('Empresa', f.empresa, (v) => setForm('empresa', v), 'Para quién es el estudio'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Y se crea'),
            h('button', { className: 'km-btn pri', onClick: () => nuevoEstudio(f.plantilla, f.empresa) },
              '＋ Crear estudio nuevo'))),
        nota({
          titulo: 'Reemplaza el estudio de esta ventana.',
          texto: 'El de KIMOS vuelve con un clic porque viene en el bundle; si el actual es tuyo, expórtalo antes. Y como la app es multiinstancia, otra ventana puede seguir con otro estudio en paralelo.',
        })));

    /* --------------------------- llevar y traer --------------------------- */
    const archivo = card('Llevar y traer el estudio', C.teal,
      'El estudio es un archivo JSON: se exporta, se versiona, se le entrega al cliente y se vuelve a cargar en cualquier ventana.',
      h('div', null,
        h('div', { className: 'km-filtros' },
          h('button', { className: 'km-btn', onClick: exportarEstudio }, '⭳ Exportar estudio (JSON)'),
          h('label', { className: 'km-btn', title: 'Carga un estudio exportado antes' }, '⭱ Importar estudio',
            h('input', {
              type: 'file', accept: '.json,application/json', style: { display: 'none' },
              onChange: (e) => {
                const file = e.target.files && e.target.files[0];
                e.target.value = '';
                if (!file) return;
                const fr = new FileReader();
                fr.onload = () => {
                  const err = importarEstudio(String(fr.result));
                  if (err) avisar('error', err);
                };
                fr.onerror = () => avisar('error', 'No se pudo leer el archivo');
                fr.readAsText(file);
              },
            })),
          h('button', { className: 'km-btn', onClick: volverASemilla }, '↺ Volver al estudio de KIMOS')),
        nota({
          titulo: 'Qué viaja en el archivo.',
          texto: 'Identidad, supuestos, líneas, precios con su fuente, planes, mercados, evidencia, perfiles y el diagnóstico. Al importarlo se comprueba la estructura y, si algo falta, dice exactamente qué.',
        })));

    /* ------------------------------- líneas ------------------------------- */
    const colsLin = [
      { k: 'app', l: 'Línea de producto', cell: (m) => h('input', { className: 'km-in', value: m.app, onChange: (e) => editarLinea(m.app, 'app', e.target.value) }) },
      { k: 'cat', l: 'Categoría de mercado', cell: (m) => h('input', { className: 'km-in', value: m.cat || '', placeholder: 'Contra qué categoría compite', onChange: (e) => editarLinea(m.app, 'cat', e.target.value) }) },
      { k: 'alt', l: 'Competidores de referencia', cell: (m) => h('input', { className: 'km-in', value: m.alt || '', placeholder: 'Nombres separados por coma', onChange: (e) => editarLinea(m.app, 'alt', e.target.value) }) },
      {
        k: 'ventaja', l: 'Ventaja 0-10', num: true,
        cell: (m) => h('input', {
          className: 'km-in km-num', type: 'number', min: 0, max: 10, step: 0.5, value: m.ventaja,
          onChange: (e) => editarLinea(m.app, 'ventaja', Math.min(10, Math.max(0, Number(e.target.value) || 0))),
        }),
      },
      { k: 'cuenta', l: 'Precios', num: true, cell: (m) => String(D.competidores.filter((c) => c.app === m.app).length) },
      { k: 'x', l: '', cell: (m) => h('button', { className: 'km-x', title: 'Quita la línea y sus precios', onClick: () => borrarLinea(m.app) }, '✕') },
    ];
    const lineas = card('Líneas de producto', C.orange,
      'Cada línea se compara contra una categoría de mercado. La ventaja de 0 a 10 es tu juicio sobre qué tan bien compites ahí, y es lo que ubica la línea en la matriz de cartera del diagnóstico.',
      h('div', null,
        tabla(colsLin, D.modulos, { key: (m) => m.n }),
        h('div', { className: 'km-ctrls' },
          campo('Nueva línea', f.nl.app, (v) => setSubForm('nl', 'app', v), 'Nombre'),
          campo('Categoría', f.nl.cat, (v) => setSubForm('nl', 'cat', v), 'Categoría de mercado'),
          campo('Competidores', f.nl.alt, (v) => setSubForm('nl', 'alt', v), 'Contra quién compite'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Añadir'),
            h('button', {
              className: 'km-btn',
              onClick: () => {
                const err = agregarLinea(f.nl);
                if (err) return avisar('error', err);
                setForm('nl', { app: '', cat: '', alt: '' });
              },
            }, '＋ Añadir línea')))));

    /* ------------------------------- precios ------------------------------ */
    const lineaSel = f.linea || (D.modulos[0] ? D.modulos[0].app : '');
    const idx = D.competidores.map((c, i) => ({ c: c, i: i })).filter((x) => x.c.app === lineaSel);
    const colsPre = [
      { k: 'comp', l: 'Competidor', cell: (x) => x.c.comp },
      { k: 'plan', l: 'Plan', cell: (x) => x.c.plan },
      { k: 'precio', l: 'Precio', num: true, cell: (x) => usd1(x.c.precio) },
      { k: 'unidad', l: 'Unidad', cell: (x) => x.c.unidad },
      { k: 'seg', l: 'Segmento', cell: (x) => x.c.seg },
      { k: 'fuente', l: 'Fuente', cell: (x) => h('span', { className: 'km-src', title: x.c.fuente }, x.c.fuente || '—') },
      { k: 'conf', l: 'Confianza', cell: (x) => pillConf(x.c.conf) },
      { k: 'x', l: '', cell: (x) => h('button', { className: 'km-x', title: 'Quita este precio', onClick: () => borrarCompetidor(x.i) }, '✕') },
    ];
    const nc = f.nc;
    const precios = card('Precios levantados', C.blue,
      'Un precio sin fuente no entra. Es la regla que separa un estudio de una opinión con tablas.',
      h('div', null,
        h('div', { className: 'km-filtros' },
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Línea'),
            selector(lineaSel, D.modulos.map((m) => m.app), (v) => setForm('linea', v), 'Elige una línea')),
          h('span', { className: 'km-cuenta' }, idx.length + ' precio(s) en esta línea')),
        idx.length ? tabla(colsPre, idx, { key: (x) => x.i })
          : h('p', { className: 'km-mut' }, 'Todavía no hay precios levantados para esta línea.'),
        h('div', { className: 'km-ctrls' },
          campo('Competidor', nc.comp, (v) => setSubForm('nc', 'comp', v), 'Nombre del competidor'),
          campo('Plan', nc.plan, (v) => setSubForm('nc', 'plan', v), 'Nombre del plan'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Precio de lista'),
            h('input', {
              className: 'km-in', type: 'number', min: 0, step: 0.01, value: nc.precio,
              placeholder: '0', onChange: (e) => setSubForm('nc', 'precio', e.target.value),
            })),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Unidad'),
            h('select', {
              className: 'km-in', value: nc.unidad, onChange: (e) => setSubForm('nc', 'unidad', e.target.value),
            }, UNIDADES.map((u) => h('option', { key: u, value: u }, u)))),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Segmento'),
            h('select', {
              className: 'km-in', value: nc.seg, onChange: (e) => setSubForm('nc', 'seg', e.target.value),
            }, SEGMENTOS.map((u) => h('option', { key: u, value: u }, u)))),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Confianza'),
            h('select', {
              className: 'km-in', value: nc.conf, onChange: (e) => setSubForm('nc', 'conf', e.target.value),
            }, ['Verificado', 'Estimado'].map((u) => h('option', { key: u, value: u }, u)))),
          campo('Fuente', nc.fuente, (v) => setSubForm('nc', 'fuente', v), 'URL o documento donde está el precio'),
          campo('Nota', nc.nota, (v) => setSubForm('nc', 'nota', v), 'Asientos incluidos, condiciones, rango'),
          h('div', { className: 'km-ctrl' },
            h('label', null, 'Añadir'),
            h('button', {
              className: 'km-btn pri',
              onClick: () => {
                const err = agregarCompetidor(Object.assign({ app: lineaSel }, nc));
                if (err) return avisar('error', err);
                setForm('nc', { comp: '', plan: '', precio: '', unidad: nc.unidad, seg: nc.seg, fuente: '', conf: nc.conf, nota: '' });
              },
            }, '＋ Añadir precio')))));

    /* ------------------------------ protocolo ----------------------------- */
    const pasos = h('div', { className: 'km-col' }, PROTOCOLO.map((x) => h('div', {
      key: x.n, className: 'km-diag', style: { '--k-g': PAL[(x.n - 1) % PAL.length] },
    }, h('h4', null, x.n + '. ' + x.titulo), h('p', null, x.texto))));

    const fuentes = plant && plant.fuentes ? card('Dónde se buscan los datos en este rubro', C.green,
      'Las fuentes cambian con el sector: lo que en software es una página de precios, en salud es un arancel y en industria un catálogo del canal.',
      h('ul', { className: 'km-mut km-lista' }, plant.fuentes.map((x, i) => h('li', { key: i }, x)))) : null;

    const agente = card('Que lo haga el agente', C.fuchsia,
      'El agente de KIMOS tiene herramientas para hacer el estudio completo sin que nadie toque un formulario.',
      h('div', null,
        qline('PROTOCOLO', 'Le dice el método y qué le falta a este estudio'),
        qline('NUEVO_ESTUDIO', 'Arranca el estudio de otra empresa con la plantilla del rubro'),
        qline('SET_IDENTIDAD', 'Declara empresa, rubro, moneda y fecha'),
        qline('AGREGAR_LINEA', 'Añade una línea de producto y su categoría'),
        qline('AGREGAR_COMPETIDOR', 'Carga un precio con su fuente y su nivel de confianza'),
        qline('ELIMINAR_COMPETIDOR', 'Quita un precio que quedó mal levantado'),
        qline('IMPORTAR_ESTUDIO / EXPORTAR_ESTUDIO', 'Trae o entrega el estudio como JSON'),
        nota({
          titulo: 'Ejemplo.',
          texto: '"Hazme el estudio de mercado de una clínica dental en Santiago": el agente crea el estudio con la plantilla de salud, levanta los aranceles publicados de la competencia, los carga con su fuente y el modelo devuelve precio sugerido, mercado y economía por paciente.',
        })));

    return h('div', { className: 'km-vista' },
      identidad, salud, plantillas, archivo, lineas, precios,
      card('Protocolo de investigación', C.amber,
        'Es lo que hace que el estudio de otra empresa valga lo mismo que el de KIMOS. Se sigue en este orden.', pasos),
      fuentes, agente);
  }

  function vistaResumen(oferta, demanda) {
    const vals = valsTexto(oferta);
    const ent = oferta.planes[oferta.planes.length - 1] || oferta.planCero;

    const filasMain = oferta.modulos.slice()
      .sort((a, b) => b.med - a.med)
      .map((m) => ({ label: m.app, a: m.med, b: m.sugerido }));

    const porHerramienta = oferta.stack.slice().sort((a, b) => b.costo - a.costo);
    const top = porHerramienta.slice(0, 9).map((s) => ({ label: s.herramienta, valor: s.costo }));
    const resto = porHerramienta.slice(9).reduce((a, s) => a + s.costo, 0);
    if (resto > 0) top.push({ label: 'Otras ' + (porHerramienta.length - 9) + ' herramientas', valor: resto });

    const escalera = oferta.planes.map((p, i) => ({
      label: p.nombre, valor: p.porUsuario, color: [C.violet, C.calipso, C.fuchsia, C.teal][i % 4],
    })).concat([{ label: 'Stack actual', valor: oferta.stackPorUsuario, color: C.orange }]);

    return h('div', { className: 'km-vista km-fade' },
      nota(D.visual.notas.resumen),
      h('div', { className: 'km-g2' },
        card('Precio sugerido de ' + emp() + ' vs. mediana del mercado', C.cyan,
          'Por módulo, normalizado al cliente tipo. La barra violeta es el mercado; la cian, KIMOS.',
          barrasDobles(filasMain, C.violet, C.cyan, 'Mediana del mercado', 'Precio sugerido KIMOS')),
        h('div', { className: 'km-col' },
          card('El gasto que ' + emp() + ' reemplaza', C.fuchsia,
            'Stack best-of-breed que arma hoy una empresa del tamaño tipo, por herramienta.',
            dona(top, oferta.stackTotal)),
          card('Escalera de planes', C.orange,
            'Precio mensual por usuario de cada plan frente al costo del stack actual.',
            barrasVert(escalera, usd1)))),
      card('Lo que dice el estudio, en cinco frases', C.green, null,
        h('div', { className: 'km-g3' }, D.visual.tldr.map((t) => tarjetaDiag(t, vals)))),
      card('Y lo que dice el estudio de demanda', C.blue,
        'El alcance comercial elegido manda sobre estos cuatro números.',
        h('div', { className: 'km-kpis' },
          kpi('SAM del alcance', mm(demanda.sam), demanda.filas.length + ' mercados · índice ' + x2(demanda.indice), C.blue),
          kpi('ARPU anual', usd(demanda.arpuAnual), 'Con el mix de planes actual', C.teal),
          kpi('ARR al año 3', usd(demanda.arr[2]), num(demanda.vivos[2]) + ' clientes vivos', C.green),
          kpi('Penetración necesaria', pct(demanda.penetracion, 2),
            demanda.penetracion > 0.02 ? 'Sobre 2%: el plan deja de ser realista' : 'Bajo el umbral de alerta',
            demanda.penetracion > 0.02 ? C.red : C.cyan))),
      h('p', { className: 'km-pie' }, 'Estudio del ' + D.meta.fecha + ' · precios de lista públicos en '
        + D.meta.moneda + ', sin impuestos ni descuentos por volumen · cliente tipo de '
        + estado.sup.usuarios + ' usuarios y ' + estado.sup.canales + ' canales · ' + emp() + ' '
        + ent.nombre + ' ' + usd(ent.mensual) + '/mes'));
  }

  function vistaMapa(oferta) {
    const o = estado.orden.mod;
    const val = (m) => ({
      app: m.app, cat: m.cat, min: m.min, med: m.med, max: m.max,
      sugerido: m.sugerido, ahorro: m.ahorro, ventaja: m.ventaja,
    })[o.key];
    const filas = oferta.modulos.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * o.dir;
    });

    const cols = [
      { k: 'app', l: 'App KIMOS', sort: true, cell: (m) => [h('b', { key: 'b' }, m.app), h('div', { key: 'd', className: 'km-sub2' }, m.que)] },
      { k: 'cat', l: 'Categoría de mercado', sort: true, cell: (m) => m.cat },
      { k: 'alt', l: 'Alternativas', cell: (m) => h('span', { className: 'km-sub2' }, m.alt) },
      { k: 'tgt', l: 'Target', cell: (m) => pill(m.target, 'km-p-v') },
      { k: 'min', l: 'Mín', num: true, sort: true, cell: (m) => usd(m.min) },
      { k: 'med', l: 'Mediana', num: true, sort: true, cell: (m) => h('span', { className: 'km-cel-med' }, usd(m.med)) },
      { k: 'max', l: 'Máx', num: true, sort: true, cell: (m) => h('span', { className: 'km-mut' }, usd(m.max)) },
      { k: 'sugerido', l: 'Sugerido', num: true, sort: true, cell: (m) => h('span', { className: 'km-cel-sug' }, usd(m.sugerido)) },
      { k: 'pu', l: 'Por usuario', num: true, cell: (m) => usd1(m.porUsuario) },
      { k: 'ahorro', l: 'Ahorro', num: true, sort: true, cell: (m) => h('span', { className: 'km-cel-ok' }, pct(m.ahorro, 0)) },
      { k: 'cuad', l: 'Cuadrante', cell: (m) => pill(m.cuadrante, CLASE_CUAD[m.cuadrante]) },
      { k: 'datos', l: 'Datos', cell: (m) => pill(m.verificados + '/' + m.planes, m.verificados >= m.planes * 0.7 ? 'km-p-ok' : 'km-p-est') },
    ];

    const t = tabla(cols, filas, {
      orden: o, onSort: (k) => setOrden('mod', k), key: (m) => m.n,
      clase: (m) => (estado.modSel === m.n ? 'on' : ''),
      onClick: (m) => commit({ modSel: estado.modSel === m.n ? null : m.n }),
    });

    const sel = estado.modSel != null ? oferta.byN.get(estado.modSel) : null;
    return h('div', { className: 'km-vista km-fade' },
      card('Mapa competitivo por aplicación', C.violet,
        'Cada app de KIMOS, contra quién compite, en qué rango se mueve el mercado y a qué precio conviene entrar. La mediana excluye planes Enterprise (Akeneo, Salsify, Cvent, Bizzabo, Kissflow, Nintex) porque son de otro segmento y distorsionan la referencia. Haz clic en una fila para ver el detalle.',
        t),
      sel ? detalleModulo(sel, oferta) : null);
  }

  function detalleModulo(sel, oferta) {
    const i = D.modulos.map((m) => m.n).indexOf(sel.n);
    const cols = [
      { k: 'comp', l: 'Competidor', cell: (r) => h('b', null, r.c.comp) },
      { k: 'plan', l: 'Plan', cell: (r) => h('span', { className: 'km-mut' }, r.c.plan) },
      { k: 'precio', l: 'Precio', num: true, cell: (r) => usd1(precioLista(r.c, r.i, estado.precios)) },
      { k: 'unidad', l: 'Unidad', cell: (r) => h('span', { className: 'km-mut' }, r.c.unidad) },
      { k: 'tipo', l: 'Cliente tipo', num: true, cell: (r) => h('span', { className: 'km-cel-sug' }, usd(r.costo)) },
      { k: 'seg', l: 'Segmento', cell: (r) => (r.c.seg === 'Enterprise' ? pill('Enterprise', 'km-p-ent') : h('span', { className: 'km-mut' }, r.c.seg)) },
      { k: 'nota', l: 'Notas', cell: (r) => h('span', { className: 'km-mut' }, r.c.nota) },
      { k: 'fuente', l: 'Fuente', cell: (r) => h('span', { className: 'km-src' }, r.c.fuente) },
    ];
    const filas = D.competidores
      .map((c, idx) => ({ c: c, i: idx, costo: costoTipo(c, estado.sup, idx, estado.precios) }))
      .filter((r) => r.c.app === sel.app);

    return h('aside', { className: 'km-detalle' },
      h('div', { className: 'km-detalle-h' },
        h('div', { style: { display: 'flex', gap: '11px', alignItems: 'center' } },
          icono(sel, i),
          h('div', null,
            h('h2', { style: { fontSize: '16px' } }, sel.app),
            h('div', { className: 'km-app-cat' }, sel.cat + ' · ' + sel.que))),
        h('button', { className: 'km-x', onClick: () => commit({ modSel: null }), title: 'Cerrar' }, '✕')),
      h('div', { className: 'km-kpis' },
        kpi('Mediana del mercado', usd(sel.med) + '/mes', 'Rango ' + usd(sel.min) + ' – ' + usd(sel.max), C.fuchsia),
        kpi('Precio sugerido', usd(sel.sugerido) + '/mes', usd1(sel.porUsuario) + ' por usuario', C.cyan),
        kpi('Ahorro vs mercado', pct(sel.ahorro, 0), 'Factor ' + x2(estado.sup.factor), C.green),
        kpi('Datos', sel.verificados + '/' + sel.planes, 'precios verificados en fuente', C.violet)),
      h('div', { className: 'km-g2' },
        h('div', { className: 'km-pc km-pro' }, h('b', null, 'A favor'), sel.pro),
        h('div', { className: 'km-pc km-con' }, h('b', null, 'En contra'), sel.contra)),
      h('div', { className: 'km-strat' }, h('b', null, 'Estrategia: '), sel.estrategia),
      tabla(cols, filas, { key: (r) => r.i }));
  }

  function vistaCompetencia(oferta) {
    const f = estado.filtro;
    const q = f.q.trim().toLowerCase();
    let filas = D.competidores.map((c, i) => ({
      c: c, i: i, app: c.app, comp: c.comp, plan: c.plan, conf: c.conf,
      precio: precioLista(c, i, estado.precios),
      costo: costoTipo(c, estado.sup, i, estado.precios),
    }));
    if (f.app) filas = filas.filter((r) => r.app === f.app);
    if (f.seg) filas = filas.filter((r) => r.c.seg === f.seg);
    if (f.conf) filas = filas.filter((r) => r.conf === f.conf);
    if (q) filas = filas.filter((r) => (r.comp + ' ' + r.plan + ' ' + r.app + ' ' + r.c.nota).toLowerCase().indexOf(q) >= 0);

    const o = estado.orden.comp;
    filas.sort((a, b) => {
      const x = a[o.key], y = b[o.key];
      return (typeof x === 'string' ? x.localeCompare(y) : (x || 0) - (y || 0)) * o.dir;
    });

    const cols = [
      { k: 'app', l: 'App KIMOS', sort: true, cell: (r) => h('span', { className: 'km-mut' }, r.app) },
      { k: 'comp', l: 'Competidor', sort: true, cell: (r) => h('b', null, r.comp) },
      { k: 'plan', l: 'Plan', sort: true, cell: (r) => h('span', { className: 'km-mut' }, r.plan) },
      {
        k: 'precio', l: 'Precio USD/mes', num: true, sort: true,
        cell: (r) => h('input', {
          className: 'km-edit' + (estado.precios[r.i] != null ? ' km-tocado' : ''),
          type: 'number', step: '0.01', min: '0', value: r.precio,
          title: 'Edita el precio y el modelo completo se recalcula',
          onChange: (e) => setPrecio(r.i, e.target.value),
        }),
      },
      { k: 'unidad', l: 'Unidad', cell: (r) => h('span', { className: 'km-mut' }, r.c.unidad) },
      { k: 'costo', l: 'Cliente tipo', num: true, sort: true, cell: (r) => h('span', { className: 'km-cel-sug' }, usd(r.costo)) },
      { k: 'seg', l: 'Segmento', cell: (r) => (r.c.seg === 'Enterprise' ? pill('Enterprise', 'km-p-ent') : h('span', { className: 'km-mut' }, r.c.seg)) },
      { k: 'nota', l: 'Notas', cell: (r) => h('span', { className: 'km-mut' }, r.c.nota) },
      { k: 'fuente', l: 'Fuente', cell: (r) => h('span', { className: 'km-src' }, r.c.fuente) },
      { k: 'conf', l: 'Confianza', sort: true, cell: (r) => pillConf(r.conf) },
    ];

    const editados = Object.keys(estado.precios).length;
    const ctrl = (label, k, min, max, step, formato) => h('div', { className: 'km-ctrl', key: k },
      h('label', null, label),
      h('div', { className: 'km-ctrl-row' },
        h('input', {
          className: 'km-range', type: 'range', min: min, max: max, step: step,
          value: estado.sup[k], onChange: (e) => setSup(k, e.target.value),
        }),
        h('span', { className: 'km-val' }, formato(estado.sup[k]))));

    return h('div', { className: 'km-vista km-fade' },
      h('div', { className: 'km-ctrls' },
        ctrl('Usuarios del cliente tipo', 'usuarios', 1, 200, 1, num),
        ctrl('Canales sociales', 'canales', 1, 30, 1, num),
        ctrl('Factor de posicionamiento', 'factor', 0.2, 1.2, 0.05, x2),
        ctrl('Descuento pago anual', 'descAnual', 0, 0.4, 0.01, (v) => pct(v, 0))),
      nota(D.visual.notas.factor),
      card('Detalle de precios de la competencia', C.calipso,
        'Los precios en cian son editables: escribe otro número y la mediana, el precio sugerido, los planes y el configurador se recalculan.',
        h('div', null,
          h('div', { className: 'km-filtros', style: { marginBottom: '12px' } },
            h('input', {
              className: 'km-in km-q', placeholder: 'Filtrar por app, competidor o nota…',
              value: f.q, onChange: (e) => setFiltro('q', e.target.value),
            }),
            selector(f.app, D.modulos.map((m) => m.app), (v) => setFiltro('app', v), 'Todas las apps'),
            selector(f.seg, ['PyME / Empresa', 'Enterprise'], (v) => setFiltro('seg', v), 'Todos los segmentos'),
            selector(f.conf, ['Verificado', 'Estimado'], (v) => setFiltro('conf', v), 'Toda confianza'),
            h('span', { className: 'km-cuenta' }, filas.length + ' de ' + D.competidores.length + ' planes · '
              + oferta.verificados + ' verificados' + (editados ? ' · ' + editados + ' editados a mano' : '')),
            editados ? h('button', { className: 'km-btn', onClick: () => commit({ precios: {} }) }, '↺ Precios originales') : null),
          tabla(cols, filas, { orden: o, onSort: (k) => setOrden('comp', k), key: (r) => r.i }))));
  }

  // El tablero se etiqueta con la empresa del estudio en curso, no con KIMOS.
  const emp = () => D.meta.empresa || 'la empresa';
  const planTope = (oferta) => oferta.planes[oferta.planes.length - 1] || oferta.planCero;

  const selector = (valor, opciones, onChange, vacio) => h('select', {
    className: 'km-in', value: valor, onChange: (e) => onChange(e.target.value),
  }, [h('option', { value: '', key: '' }, vacio)].concat(
    opciones.map((o) => h('option', { value: o, key: o }, o))));

  function tarjetaPlan(p, destacado) {
    return h('article', { className: 'km-plan' + (destacado ? ' hot' : ''), key: p.id },
      destacado ? h('span', { className: 'km-plan-tag' }, 'MÁS VENDIBLE') : null,
      h('h3', null, p.nombre),
      h('div', { className: 'km-plan-who' }, p.para),
      h('div', { className: 'km-plan-precio' }, usd(p.mensual)),
      h('div', { className: 'km-plan-pu' }, 'al mes · ' + usd1(p.porUsuario) + ' por usuario'),
      h('div', { className: 'km-plan-desc' }, p.incluye),
      qline('Suma a la carta', usd(p.suma)),
      h('div', { className: 'km-qline' },
        h('span', null, 'Descuento bundle'),
        h('span', null,
          h('input', {
            className: 'km-edit', type: 'number', min: '0', max: '95', step: '1',
            value: Math.round(p.descuento * 100), style: { width: '62px' },
            title: 'Descuento del plan sobre la suma a la carta',
            onChange: (e) => setDesc(p.id, Number(e.target.value) / 100),
          }), ' %')),
      qline('Precio anual', usd(p.anual)),
      qline('Ahorro anual del cliente', usd(p.ahorroAnual), C.green),
      qline('Módulos incluidos', String(p.mods.length)));
  }

  function vistaPlanes(oferta) {
    const banda = oferta.ratioStack > 0.60 ? 'riesgo' : oferta.ratioStack < 0.25 ? 'aviso' : 'ok';
    const colorBanda = banda === 'ok' ? C.green : banda === 'riesgo' ? C.red : C.amber;
    const cols = [
      { k: 'nec', l: 'Necesidad', cell: (s) => s.necesidad },
      { k: 'her', l: 'Herramienta de hoy', cell: (s) => h('b', null, s.herramienta) },
      { k: 'plan', l: 'Plan', cell: (s) => h('span', { className: 'km-mut' }, s.plan) },
      { k: 'uni', l: 'Unidad', cell: (s) => h('span', { className: 'km-mut' }, s.unidad) },
      { k: 'costo', l: 'Costo mensual', num: true, cell: (s) => usd(s.costo) },
    ];
    const pie = [filaTotal([
      { v: 'TOTAL stack best-of-breed', span: 4 },
      { v: usd(oferta.stackTotal), num: true },
    ])];

    return h('div', { className: 'km-vista km-fade' },
      card('Planes por tamaño de empresa', C.fuchsia,
        'El descuento de bundle es editable en cada plan. Sin descuento, la suma de módulos da un precio que ningún cliente paga.',
        h('div', { className: 'km-g3' }, oferta.planes.map((p) => tarjetaPlan(p, p.id === 'business')))),
      card('Kits por necesidad del cliente', C.teal,
        'Para clientes que no necesitan la suite completa sino resolver un frente concreto. Es la oferta de entrada por defecto: menos firmas en el comité, ciclo más corto.',
        h('div', { className: 'km-g3' }, oferta.kits.map((p) => tarjetaPlan(p, false)))),
      card('Chequeo de realidad', C.orange,
        'Lo que gasta hoy el cliente tipo armando el stack por su cuenta. Es el número contra el que se negocia.',
        h('div', { className: 'km-g2' },
          tabla(cols, oferta.stack, { key: (s, i) => i, pie: pie }),
          h('div', { className: 'km-col' },
            h('div', { className: 'km-kpis', style: { gridTemplateColumns: '1fr 1fr' } },
              kpi('Stack actual', usd(oferta.stackTotal), usd1(oferta.stackPorUsuario) + ' por usuario', C.orange),
              kpi(emp() + ' · ' + planTope(oferta).nombre, usd(planTope(oferta).mensual),
                usd1(planTope(oferta).porUsuario) + ' por usuario', C.cyan),
              kpi(emp() + ' sobre ese gasto', pct(oferta.ratioStack, 0),
                banda === 'ok' ? 'Dentro de la banda sana' : banda === 'riesgo' ? 'Sobre 60%' : 'Bajo 25%', colorBanda),
              kpi('Ahorro anual del cliente', usd(oferta.ahorroAnualStack), 'Enterprise vs stack', C.green)),
            nota(D.visual.notas.banda)))));
  }

  function vistaConfigurador(oferta) {
    const sel = estado.cfg.mods.filter((a) => oferta.byApp.has(a));
    const suma = sel.reduce((a, app) => a + oferta.byApp.get(app).sugerido, 0);
    const precio = Math.round(suma * (1 - estado.cfg.desc));
    const equivalente = oferta.stack.filter((s) => sel.indexOf(s.app) >= 0).reduce((a, s) => a + s.costo, 0);
    const ratio = equivalente ? precio / equivalente : 0;
    const veredicto = !sel.length ? 'Selecciona módulos para cotizar.'
      : !equivalente ? 'Ninguno de los módulos elegidos tiene equivalente en el stack de referencia: la comparación de ahorro no aplica.'
      : ratio > 0.6 ? '⚠ Estás sobre el 60% del gasto actual: el argumento de ahorro se debilita.'
      : ratio < 0.25 ? '⚠ Bajo el 25% del gasto actual: estás dejando margen sobre la mesa.'
      : '✓ La cotización cae dentro de la banda sana de 25%–60% del gasto actual del cliente.';

    const presets = [{ id: '__todos', nombre: 'Suite completa' }]
      .concat(D.planes.map((p) => ({ id: p.id, nombre: p.nombre })))
      .concat(D.kits.map((p) => ({ id: p.id, nombre: p.nombre })))
      .concat([{ id: '__ninguno', nombre: 'Limpiar' }]);

    const mods = oferta.modulos.map((m) => h('label', {
      key: m.n, className: 'km-mod' + (sel.indexOf(m.app) >= 0 ? ' on' : ''),
    },
      h('input', { type: 'checkbox', checked: sel.indexOf(m.app) >= 0, onChange: () => toggleMod(m.app) }),
      h('span', null, corto(m.app)),
      h('span', { className: 'km-mod-pz' }, usd(m.sugerido))));

    const cotizacion = h('div', { className: 'km-quote' },
      h('div', { className: 'km-quote-k' }, 'Cotización'),
      h('div', { className: 'km-quote-big' }, usd(precio)),
      h('div', { style: { color: 'var(--k-mut)', fontSize: '12px', marginBottom: '12px' } },
        'al mes · ' + usd1(precio / estado.sup.usuarios) + ' por usuario · ' + sel.length + ' módulos'),
      qline('Suma a la carta', usd(suma)),
      h('div', { className: 'km-qline' },
        h('span', null, 'Descuento bundle'),
        h('span', null,
          h('input', {
            className: 'km-edit', type: 'number', min: '0', max: '95', step: '1',
            value: Math.round(estado.cfg.desc * 100), style: { width: '62px' },
            onChange: (e) => commit({ cfg: Object.assign({}, estado.cfg, { desc: Math.min(0.95, Math.max(0, Number(e.target.value) / 100)) }) }),
          }), ' %')),
      qline('Precio anual', usd(precio * 12 * (1 - estado.sup.descAnual))),
      qline('Equivalente en el mercado', usd(equivalente), C.orange),
      qline('Ahorro anual del cliente', usd(Math.max(0, (equivalente - precio) * 12)), C.green),
      qline('Módulos incluidos', String(sel.length)),
      h('div', { className: 'km-veredicto' }, veredicto));

    return h('div', { className: 'km-vista km-fade' },
      card('Configurador de suscripción', C.cyan,
        'Marca los módulos que necesita el cliente y obtén la cotización al instante, comparada contra lo que gastaría comprando cada herramienta por separado.',
        h('div', { className: 'km-cfg' },
          h('div', null,
            h('div', { className: 'km-filtros', style: { marginBottom: '13px' } },
              presets.map((p) => h('button', {
                key: p.id, className: 'km-btn', onClick: () => setPreset(p.id),
              }, p.nombre))),
            h('div', { className: 'km-modgrid' }, mods)),
          cotizacion)));
  }

  function vistaMercados(oferta, demanda) {
    const a = estado.alcance;
    const uniq = (k) => Array.from(new Set(D.demanda.paises.map((p) => p[k]))).sort();
    const precio = (id, ix) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || { mensual: 0 }).mensual * ix);
    const reco = (ix) => (ix >= 0.95 ? 'Subir el factor a 0,85–0,90'
      : ix >= 0.75 ? 'Lista regional, factor 0,7'
      : ix >= 0.55 ? 'Mantener factor 0,55' : 'Solo autoservicio');
    const filas = demanda.filas.slice().sort((x, y) => y.sam - x.sam);

    const cols = [
      { k: 'pais', l: 'Mercado', cell: (f) => h('b', null, f.pais) },
      { k: 'region', l: 'Región', cell: (f) => h('span', { className: 'km-mut' }, f.region) },
      { k: 'idioma', l: 'Idioma', cell: (f) => h('span', { className: 'km-mut' }, f.idioma) },
      { k: 'prio', l: 'Prioridad', cell: (f) => pill(f.prioridad, CLASE_PRIO[f.prioridad] || 'km-p-v') },
      { k: 'cob', l: 'Cobertura', num: true, cell: (f) => pct(f.cobertura, 0) },
      { k: 'saas', l: 'SaaS', num: true, cell: (f) => h('span', { className: 'km-mut' }, mm(f.saas)) },
      { k: 'tam', l: 'TAM', num: true, cell: (f) => h('span', { className: 'km-mut' }, mm(f.tam)) },
      { k: 'sam', l: 'SAM', num: true, cell: (f) => h('span', { className: 'km-cel-sug' }, mm(f.sam)) },
      { k: 'ix', l: 'Índice', num: true, cell: (f) => x2(f.indice) },
      { k: 'st', l: 'Starter', num: true, cell: (f) => usd(precio('starter', f.indice)) },
      { k: 'bs', l: 'Business', num: true, cell: (f) => usd(precio('business', f.indice)) },
      { k: 'ent', l: 'Enterprise', num: true, cell: (f) => usd(precio('enterprise', f.indice)) },
      { k: 'reco', l: 'Recomendación', cell: (f) => h('span', { className: 'km-mut' }, reco(f.indice)) },
    ];

    return h('div', { className: 'km-vista km-fade' },
      h('div', { className: 'km-ctrls', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' } },
        h('div', { className: 'km-ctrl' }, h('label', null, 'Región'), selector(a.region, uniq('region'), (v) => setAlcance('region', v), 'Todas')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'País'), selector(a.pais, D.demanda.paises.map((p) => p.pais), (v) => setAlcance('pais', v), 'Todos')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'Idioma'), selector(a.idioma, uniq('idioma'), (v) => setAlcance('idioma', v), 'Todos')),
        h('div', { className: 'km-ctrl' }, h('label', null, 'Prioridad comercial'), selector(a.prioridad, uniq('prioridad'), (v) => setAlcance('prioridad', v), 'Todas')),
        h('div', { className: 'km-ctrl' },
          h('label', null, 'Alcance'),
          h('div', { className: 'km-ctrl-row' },
            h('span', { className: 'km-cuenta' }, demanda.filas.length + ' de ' + D.demanda.paises.length + ' mercados'),
            h('button', { className: 'km-btn', onClick: () => commit({ alcance: { region: '', idioma: '', prioridad: '', pais: '' } }) }, 'Global')))),
      h('div', { className: 'km-kpis' },
        kpi('Mercado SaaS del alcance', mm(demanda.mercado), 'Base del embudo', C.violet),
        kpi('TAM', mm(demanda.tam), 'Suites de gestión en PyME y mid-market', C.blue),
        kpi('SAM', mm(demanda.sam), 'Con la cobertura comercial de cada país', C.cyan),
        kpi('Índice de precio', x2(demanda.indice), 'Ponderado por SAM · 1,00 = lista EE.UU.', C.fuchsia),
        kpi('ARPU anual', usd(demanda.arpuAnual), 'Base ' + usd(demanda.arpuAnualBase) + ' × índice', C.teal),
        kpi('Penetración al año 3', pct(demanda.penetracion, 2),
          demanda.penetracion > 0.02 ? 'Sobre 2%: alcance demasiado chico' : 'Bajo el umbral de alerta',
          demanda.penetracion > 0.02 ? C.red : C.green)),
      h('div', { className: 'km-g2' },
        card('Dónde está el mercado alcanzable', C.cyan,
          'SAM por mercado, ya descontada la cobertura comercial realista de cada país.',
          barrasSimples(filas.slice(0, 15).map((f) => ({ label: f.pais, valor: f.sam, nota: f.prioridad })), C.cyan, mm)),
        card('Precio por país', C.fuchsia,
          'El mismo plan Business ajustado por el índice de precio de cada mercado. Es la misma lista con varios precios, no varios productos.',
          barrasSimples(filas.slice(0, 15).map((f) => ({ label: f.pais, valor: precio('business', f.indice) })), C.fuchsia, usd))),
      card('Los mercados, uno por uno', C.violet,
        'El SAM de esta tabla usa la cobertura por prioridad comercial de cada país, más fina que la cobertura por región.',
        tabla(cols, filas, { key: (f) => f.pais, title: (f) => f.contexto })));
  }

  function vistaEconomia(oferta, demanda) {
    const s = estado.sup;
    const alerta = demanda.ratio < 2.5;
    const cols = [
      { k: 'coh', l: 'Cohorte', cell: (c) => 'Captados en el año ' + c.anio },
      { k: 'nuevos', l: 'Clientes nuevos', num: true, cell: (c) => num(c.nuevos) },
      { k: 'a1', l: 'Vivos al cierre año 1', num: true, cell: (c) => (c.vivos[0] ? num(c.vivos[0]) : '—') },
      { k: 'a2', l: 'Año 2', num: true, cell: (c) => (c.vivos[1] ? num(c.vivos[1]) : '—') },
      { k: 'a3', l: 'Año 3', num: true, cell: (c) => (c.vivos[2] ? num(c.vivos[2]) : '—') },
    ];
    const pie = [
      filaTotal([{ v: 'Clientes vivos' }, { v: num(s.clientes3), num: true },
        { v: num(demanda.vivos[0]), num: true }, { v: num(demanda.vivos[1]), num: true }, { v: num(demanda.vivos[2]), num: true }]),
    ];
    const ctrl = (label, k, min, max, step, formato) => h('div', { className: 'km-ctrl', key: k },
      h('label', null, label),
      h('div', { className: 'km-ctrl-row' },
        h('input', {
          className: 'km-range', type: 'range', min: min, max: max, step: step,
          value: s[k], onChange: (e) => setSup(k, e.target.value),
        }),
        h('span', { className: 'km-val' }, formato(s[k]))));

    const mixSuma = ['starter', 'business', 'enterprise'].reduce((a, k) => a + (estado.mix[k] || 0), 0);

    return h('div', { className: 'km-vista km-fade' },
      h('div', { className: 'km-ctrls' },
        ctrl('Churn mensual', 'churn', 0.01, 0.12, 0.005, (v) => pct(v, 1)),
        ctrl('Margen bruto', 'margen', 0.4, 0.95, 0.01, (v) => pct(v, 0)),
        ctrl('CAC promedio', 'cac', 100, 4000, 50, usd),
        ctrl('Clientes captados al año 3', 'clientes3', 50, 3000, 10, num)),
      h('div', { className: 'km-kpis' },
        kpi('ARPU mensual base', usd(demanda.arpuMensual), 'Mix ' + pct(estado.mix.starter, 0) + ' / '
          + pct(estado.mix.business, 0) + ' / ' + pct(estado.mix.enterprise, 0), C.violet),
        kpi('ARPU anual del alcance', usd(demanda.arpuAnual), 'Índice ' + x2(demanda.indice), C.teal),
        kpi('Vida media', x1(demanda.vidaMedia) + ' meses', 'Inversa del churn ' + pct(s.churn, 1), C.blue),
        kpi('LTV', usd(demanda.ltv), 'ARPU × margen × vida media', C.cyan),
        kpi('LTV : CAC', x1(demanda.ratio) + ' : 1', alerta ? 'Bajo el benchmark PyME (2,5:1)' : 'Sobre el benchmark PyME', alerta ? C.red : C.green),
        kpi('CAC payback', x1(demanda.payback) + ' meses', demanda.payback > 12 ? 'Sobre los 12 meses objetivo' : 'Benchmark PyME: 6,2 meses',
          demanda.payback > 12 ? C.red : C.green)),
      h('div', { className: 'km-g2' },
        card('ARR a tres años', C.green,
          'Cada cohorte se capta repartida en 12 meses y se le aplica supervivencia mes a mes. Sin ese descuento el churn no afectaría el ARR y la proyección sería falsa.',
          barrasVert([0, 1, 2].map((i) => ({
            label: 'Año ' + (i + 1), valor: demanda.arr[i], color: [C.violet, C.calipso, C.cyan][i],
          })), usd)),
        card('Mix de planes', C.fuchsia,
          'Cuánto pesa cada plan en la base de clientes. Mueve el mix y el ARPU, el LTV y el ARR se recalculan.',
          h('div', null,
            ['starter', 'business', 'enterprise'].map((k) => {
              const p = oferta.planes.filter((x) => x.id === k)[0];
              return h('div', { className: 'km-ctrl', key: k, style: { marginBottom: '10px' } },
                h('label', null, p.nombre + ' · ' + usd(p.mensual) + '/mes'),
                h('div', { className: 'km-ctrl-row' },
                  h('input', {
                    className: 'km-range', type: 'range', min: 0, max: 1, step: 0.05,
                    value: estado.mix[k] || 0, onChange: (e) => setMix(k, e.target.value),
                  }),
                  h('span', { className: 'km-val' }, pct(estado.mix[k], 0))));
            }),
            h('div', { className: 'km-cuenta', style: Math.abs(mixSuma - 1) > 0.001 ? { color: C.red } : null },
              'Suma del mix: ' + pct(mixSuma, 0) + (Math.abs(mixSuma - 1) > 0.001 ? ' — debería sumar 100%' : ''))))),
      card('Proyección por cohorte', C.cyan,
        'De los ' + num(s.clientes3) + ' clientes captados en tres años quedan vivos ' + num(demanda.vivos[2])
        + ' al cierre del año 3: una retención del ' + pct(demanda.retencion, 0)
        + '. Entre el 40% y el 60% del churn ocurre antes del tercer mes, así que esa cifra se gana en el onboarding, no en la venta.',
        tabla(cols, demanda.cohortes, { key: (c) => c.anio, pie: pie })));
  }

  function vistaClientes() {
    const perfiles = D.icp.map((p, i) => h('article', { className: 'km-appcard', key: i },
      h('div', { className: 'km-app-top' },
        h('div', null,
          h('div', { className: 'km-app-nm' }, p.perfil),
          h('div', { className: 'km-app-cat' }, p.rol + ' · ' + p.tamano))),
      h('div', { className: 'km-prow' }, h('div', null, 'Producto ', h('b', null, p.producto))),
      h('div', { className: 'km-pc km-con' }, h('b', null, 'Dolor'), p.dolor),
      h('div', { className: 'km-pc km-pro' }, h('b', null, 'Gatillo de compra'), p.gatillo),
      h('div', { className: 'km-strat', style: { fontStyle: 'italic' } }, '“' + p.objecion + '”'),
      h('div', { className: 'km-strat' }, h('b', null, 'Cómo se le vende: '), p.venta)));

    const colsSeg = [
      { k: 'seg', l: 'Segmento', cell: (s) => h('b', null, s.segmento) },
      { k: 'emp', l: 'Empleados', cell: (s) => h('span', { className: 'km-mut' }, s.empleados) },
      { k: 'ver', l: 'Veredicto', cell: (s) => pill(s.veredicto, s.veredicto.indexOf('Objetivo') === 0 ? 'km-p-g' : s.veredicto === 'No perseguir' ? 'km-p-r' : 'km-p-o') },
      { k: 'plan', l: 'Plan sugerido', cell: (s) => h('span', { className: 'km-mut' }, s.plan) },
      { k: 'por', l: 'Por qué', cell: (s) => h('span', { className: 'km-mut' }, s.porque) },
      { k: 'rie', l: 'Riesgo', cell: (s) => h('span', { className: 'km-mut' }, s.riesgo) },
    ];

    const evidencia = D.evidencia.map((g) => {
      const cols = g.cols.map((c, j) => ({
        k: 'c' + j, l: c, num: j > 0 && j < g.cols.length - 1 && g.cols.length > 4,
        cell: (f) => (j === g.cols.length - 1 ? pillConf(f[j]) : h('span', { className: j === 0 ? null : 'km-mut' }, f[j])),
      }));
      return card(g.titulo, C.blue, null, tabla(cols, g.filas, { key: (f, i) => i }), { key: g.titulo });
    });

    return h('div', { className: 'km-vista km-fade' },
      card('Perfiles de cliente ideal', C.violet,
        'Seis perfiles con el dolor que los mueve, el gatillo que dispara la compra y la objeción que hay que responder.',
        h('div', { className: 'km-g3' }, perfiles)),
      card('Segmentación por tamaño', C.orange, null, tabla(colsSeg, D.segmentos, { key: (s, i) => i })),
      evidencia);
  }

  function vistaProsContras(oferta) {
    const tarjetas = oferta.modulos.map((m, i) => h('article', { className: 'km-appcard', key: m.n },
      h('div', { className: 'km-app-top' },
        icono(m, i),
        h('div', null,
          h('div', { className: 'km-app-nm' }, m.app),
          h('div', { className: 'km-app-cat' }, m.cat))),
      h('div', { className: 'km-app-cat', style: { marginBottom: '4px' } }, 'Compite con: ' + m.alt),
      h('div', { className: 'km-pc km-pro' }, h('b', null, 'A favor'), m.pro),
      h('div', { className: 'km-pc km-con' }, h('b', null, 'En contra'), m.contra),
      h('div', { className: 'km-prow' },
        h('div', null, 'Mercado ', h('b', null, usd(m.min) + '–' + usd(m.max))),
        h('div', null, 'Sugerido ', h('b', null, usd(m.sugerido))),
        h('div', null, 'Cuadrante ', h('b', null, m.cuadrante))),
      h('div', { className: 'km-strat' }, h('b', null, 'Estrategia: '), m.estrategia)));

    return h('div', { className: 'km-vista km-fade' },
      nota(D.visual.notas.proscontras),
      h('div', { className: 'km-g3' }, tarjetas));
  }

  function vistaDiagnostico(oferta) {
    const vals = valsTexto(oferta);
    const scores = D.visual.scores.map((s) => h('div', { key: s.dim },
      h('div', { className: 'km-score' },
        h('span', { className: 'km-score-lb' }, s.dim),
        h('span', { className: 'km-bar' }, h('i', { style: { width: (s.nota * 10) + '%' } })),
        h('span', { className: 'km-score-sc' }, s.nota + '/10')),
      h('div', { className: 'km-score-tx' }, s.texto)));

    // Matriz de cartera: lo que paga el mercado contra la ventaja de KIMOS.
    const W = 720, H = 400, P = 46;
    const maxMed = Math.max.apply(null, oferta.modulos.map((m) => m.med).concat([1]));
    const xs = (v) => P + (v / 10) * (W - P * 2);
    const ys = (v) => H - P - Math.sqrt(v / maxMed) * (H - P * 2);
    const puntos = oferta.modulos.map((m) => {
      const r = Math.max(5, Math.sqrt(m.sugerido) * 0.85);
      return h('g', { key: m.n, className: 'km-pt' },
        h('circle', {
          cx: xs(m.ventaja), cy: ys(m.med), r: r,
          fill: m.cuadrante === 'APOSTAR' ? C.green : m.cuadrante === 'REPLANTEAR' ? C.red
            : m.cuadrante === 'MONETIZAR CON CUIDADO' ? C.orange : C.cyan,
        }, h('title', null, m.app + ' — mercado ' + usd(m.med) + '/mes · sugerido ' + usd(m.sugerido)
          + '/mes · ventaja ' + m.ventaja + '/10 · ' + m.cuadrante)),
        h('text', { x: xs(m.ventaja), y: ys(m.med) - r - 4, textAnchor: 'middle' }, corto(m.app)));
    });
    const matriz = h('div', { className: 'km-chart-wrap' },
      h('svg', { className: 'km-chart', viewBox: '0 0 ' + W + ' ' + H, style: { minWidth: '620px' } },
        h('rect', { x: xs(5.5), y: 12, width: W - P - xs(5.5), height: ys(oferta.medianaCartera) - 12, fill: C.green, opacity: .07 }),
        h('rect', { x: P, y: 12, width: xs(5.5) - P, height: ys(oferta.medianaCartera) - 12, fill: C.orange, opacity: .07 }),
        h('rect', { x: xs(5.5), y: ys(oferta.medianaCartera), width: W - P - xs(5.5), height: H - P - ys(oferta.medianaCartera), fill: C.cyan, opacity: .07 }),
        h('text', { x: W - P - 6, y: 26, textAnchor: 'end' }, 'APOSTAR'),
        h('text', { x: P + 6, y: 26 }, 'MONETIZAR CON CUIDADO'),
        h('text', { x: W - P - 6, y: H - P - 8, textAnchor: 'end' }, 'DIFERENCIAR, NO FACTURAR'),
        h('text', { x: P + 6, y: H - P - 8 }, 'REPLANTEAR'),
        h('line', { x1: P, y1: H - P, x2: W - P, y2: H - P, className: 'km-ax' }),
        h('line', { x1: P, y1: 12, x2: P, y2: H - P, className: 'km-ax' }),
        puntos,
        h('text', { x: W / 2, y: H - 12, textAnchor: 'middle' }, 'Ventaja competitiva →'),
        h('text', { x: 14, y: H / 2, textAnchor: 'middle', transform: 'rotate(-90 14 ' + H / 2 + ')' }, 'Lo que paga el mercado →')));

    const decisiones = D.decisiones.map((d) => h('div', {
      className: 'km-diag', key: d.n, style: { '--k-g': d.impacto === 'alto' ? C.fuchsia : C.blue },
    },
      h('h4', null, d.n + '. ' + d.decision),
      h('p', null, h('b', null, 'Oferta. '), d.oferta),
      h('p', null, h('b', null, 'Demanda. '), d.demanda),
      h('p', { style: { color: 'var(--k-tx)' } }, h('b', null, 'Qué hacer. '), d.hacer)));

    const totalSuite = oferta.aLaCarta || 1;
    const concentracion = oferta.modulos.slice()
      .sort((a, b) => b.sugerido - a.sugerido).slice(0, 12)
      .map((m) => ({ label: m.app, valor: m.sugerido / totalSuite }));

    return h('div', { className: 'km-vista km-fade' },
      h('div', { className: 'km-g2' },
        card('Dónde está parado KIMOS', C.green,
          'Evaluación por dimensión, de 0 a 10, según la posición competitiva que muestra este estudio.',
          h('div', null, scores)),
        card('Concentración del valor', C.cyan,
          'Qué porcentaje del precio total de la suite aporta cada módulo. Muestra de qué depende realmente el ingreso.',
          barrasSimples(concentracion, (i) => PAL[i % PAL.length], (v) => pct(v, 1))),
        ),
      card('Sugerencias y mejoras', C.fuchsia,
        'Ocho movimientos concretos que salen de cruzar los precios de la competencia con la demanda.',
        h('div', { className: 'km-col' }, D.visual.sugerencias.map((s) => tarjetaDiag(s, vals)))),
      card('Las ocho decisiones del estudio', C.violet,
        'Cada una con el dato de oferta y el de demanda que la sostienen. Si un dato cambia, la decisión se revisa.',
        h('div', { className: 'km-g2' }, decisiones)),
      card('Matriz de cartera', C.cyan,
        'Horizontal: la ventaja competitiva de cada línea (0 a 10). Vertical: lo que paga el mercado, en escala de raíz. El corte vertical está en 5,5 y el horizontal en la mediana de la cartera (' + usd(oferta.medianaCartera) + ').',
        matriz),
      card('Conclusión', C.orange, null,
        h('div', { className: 'km-col' }, D.visual.conclusiones.map((c) => tarjetaDiag(c, vals)))),
      card('Advertencias metodológicas', C.amber,
        'Lo que este estudio no prueba. Leerlo antes de anclar un precio.',
        h('ol', { className: 'km-hint', style: { paddingLeft: '18px', lineHeight: 1.9 } },
          D.notas.map((n, i) => h('li', { key: i }, n.replace(/^\d+\.\s*/, ''))))));
  }

  /* -------------------------------- render ------------------------------- */

  function Component() {
    const [st, setSt] = React.useState(estado);
    React.useEffect(() => {
      oyentes.add(setSt);
      return () => { oyentes.delete(setSt); };
    }, []);

    setLocale(st.tema);
    const oferta = React.useMemo(() => calcularOferta(D, st.sup, st.desc, st.precios), [st.sup, st.desc, st.precios, st.rev]);
    const demanda = React.useMemo(() => calcularDemanda(D, st.sup, st.alcance, oferta, st.mix), [st.sup, st.alcance, st.mix, oferta, st.rev]);

    const ent = oferta.planes[oferta.planes.length - 1] || oferta.planCero;
    const banda = oferta.ratioStack > 0.60 ? C.red : oferta.ratioStack < 0.25 ? C.amber : C.green;
    // Un estudio recién creado no tiene con qué afirmar bandas ni ahorros.
    const vacio = !D.competidores.length;
    const alcanceTxt = st.alcance.pais || st.alcance.region || st.alcance.idioma || st.alcance.prioridad || 'Alcance global';

    const cuerpo = st.tab === 'mapa' ? vistaMapa(oferta)
      : st.tab === 'competencia' ? vistaCompetencia(oferta)
      : st.tab === 'planes' ? vistaPlanes(oferta)
      : st.tab === 'configurador' ? vistaConfigurador(oferta)
      : st.tab === 'mercados' ? vistaMercados(oferta, demanda)
      : st.tab === 'economia' ? vistaEconomia(oferta, demanda)
      : st.tab === 'clientes' ? vistaClientes()
      : st.tab === 'proscontras' ? vistaProsContras(oferta)
      : st.tab === 'diagnostico' ? vistaDiagnostico(oferta)
      : st.tab === 'estudio' ? vistaEstudio()
      : vistaResumen(oferta, demanda);

    const temaActual = TEMAS.filter((t) => t[0] === st.tema)[0] || TEMAS[0];

    const menuTema = h('div', { className: 'km-menu-wrap' },
      h('button', {
        className: 'km-btn' + (st.menuTema ? ' pri' : ''),
        title: 'Elige cómo se ve el tablero',
        onClick: () => commit({ menuTema: !st.menuTema }),
      }, temaActual[2] + ' ' + temaActual[1]),
      st.menuTema ? h('div', { className: 'km-menu' }, TEMAS.map(([id, label, ico, desc]) => h('button', {
        key: id, className: st.tema === id ? 'on' : '',
        onClick: () => commit({ tema: id, menuTema: false }),
      }, h('span', null, ico), h('span', null, label, h('small', null, desc))))) : null);

    const cabecera = h('header', { className: 'km-head' },
      h('div', { className: 'km-brand' },
        h('div', { className: 'km-logo' }, h('span', null, 'K')),
        h('div', null,
          h('h1', { className: 'km-tit' },
            (D.meta.empresa ? D.meta.empresa + ' · ' : '') + (D.meta.titulo || 'Estudio de Mercado y Modelo de Precios'),
            h('span', { className: 'km-ver', title: 'Estudio de Mercado v' + APP_VERSION }, 'v' + APP_VERSION)),
          h('div', { className: 'km-sub' }, D.modulos.length + ' ' + (D.meta.unidadNegocio || 'líneas') + ' · '
            + D.competidores.length + ' planes de competencia analizados · precios de lista '
            + (D.meta.moneda || 'USD') + ' · levantado el ' + (D.meta.fecha || 'sin fecha') + ' · ',
            h('span', { className: 'km-chip-alc', title: 'Alcance del análisis de demanda' }, alcanceTxt)))),
      h('div', { className: 'km-tools' },
        h('button', {
          className: 'km-btn', title: 'Vuelve a los supuestos, precios y descuentos del estudio',
          onClick: () => commit({
            sup: supBase(D), desc: descBase(D),
            mix: mixBase(D), precios: {}, cfg: { mods: [], desc: 0.5 },
          }),
        }, '↺ Restablecer'),
        h('button', { className: 'km-btn', onClick: () => exportar(oferta, demanda), title: 'Exporta a CSV la pestaña actual' }, '⭳ Exportar datos'),
        menuTema,
        h('button', {
          className: 'km-btn pri', title: 'Imprime el tablero o lo guarda como PDF',
          onClick: () => { try { window.print(); } catch (e) { /* sin soporte de impresión */ } },
        }, '⎙ Imprimir / PDF')));

    const kpis = h('div', { className: 'km-kpis' },
      kpi('Gasto actual del cliente', usd(oferta.stackTotal), usd1(oferta.stackPorUsuario) + ' por usuario/mes', C.orange),
      kpi(emp() + ' · ' + ent.nombre, usd(ent.mensual), usd1(ent.porUsuario) + ' por usuario/mes', C.violet),
      kpi(emp() + ' vs. gasto actual', vacio ? '—' : pct(oferta.ratioStack, 0),
        vacio ? 'Sin precios levantados todavía'
          : oferta.ratioStack > 0.6 ? 'Sobre la banda sana'
            : oferta.ratioStack < 0.25 ? 'Bajo la banda sana' : 'Dentro de la banda sana', vacio ? C.violet : banda),
      kpi('Ahorro anual del cliente', vacio ? '—' : usd(oferta.ahorroAnualStack),
        vacio ? 'Sin precios levantados todavía' : 'Argumento central de venta', C.cyan),
      kpi('Precios verificados', oferta.verificados + '/' + D.competidores.length,
        vacio ? 'Empieza por la pestaña Este estudio' : 'El resto requiere validación', C.fuchsia));

    const navTabs = h('nav', { className: 'km-tabs-box' }, TABS.map(([id, label, ico]) => h('button', {
      key: id, className: 'km-tab' + (st.tab === id ? ' on' : ''),
      onClick: () => commit({ tab: id, menuTema: false }),
    }, h('span', { className: 'km-tab-i' }, ico), label)));

    return h('div', { className: 'kimos-mercado km-' + st.tema },
      h('div', { className: 'km-scroll' },
        h('div', { className: 'km-wrap' }, cabecera, kpis, navTabs, cuerpo)));
  }

  /* -------------------------------- agente -------------------------------- */

  let desregistrar = null;
  const CLAVES_SUP = Object.keys(supBase(D));

  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    desregistrar = shell.agent.register({
      label: 'Estudio de Mercado',
      description: 'Estudio de mercado competitivo y modelo de precios. Trae hecho el de KIMOS —precio sugerido por línea contra la competencia, planes, configurador, mercado por país y economía por cliente— y sirve para hacer el de cualquier otra empresa: NUEVO_ESTUDIO arranca con la estructura del rubro, PROTOCOLO dice el método y qué falta, y AGREGAR_LINEA y AGREGAR_COMPETIDOR cargan la investigación con su fuente. El agente también mueve supuestos, edita precios, cotiza y lee todo lo que se recalcula.',
      tools: [
        {
          name: 'SET_SUPUESTO',
          description: 'Cambia un supuesto del modelo y recalcula todo. Claves: ' + CLAVES_SUP.join(', ') + '. Los porcentajes van en fracción (0,55 = 55%).',
          inputSchema: {
            type: 'object',
            properties: { clave: { type: 'string', enum: CLAVES_SUP }, valor: { type: 'number' } },
            required: ['clave', 'valor'],
          },
        },
        {
          name: 'SET_DESCUENTO_PLAN',
          description: 'Cambia el descuento de un plan o kit sobre la suma a la carta (0,6 = 60%).',
          inputSchema: {
            type: 'object',
            properties: { plan: { type: 'string', enum: Object.keys(descBase(D)) }, descuento: { type: 'number' } },
            required: ['plan', 'descuento'],
          },
        },
        {
          name: 'SET_PRECIO_COMPETIDOR',
          description: 'Corrige el precio de lista de un plan de la competencia (USD/mes) y recalcula mediana, precio sugerido, planes y cotización.',
          inputSchema: {
            type: 'object',
            properties: {
              competidor: { type: 'string' }, plan: { type: 'string' }, precio: { type: 'number' },
            },
            required: ['competidor', 'plan', 'precio'],
          },
        },
        {
          name: 'COTIZAR',
          description: 'Arma una cotización en el configurador con los módulos indicados (nombres exactos de las apps de KIMOS) y un descuento opcional.',
          inputSchema: {
            type: 'object',
            properties: {
              modulos: { type: 'array', items: { type: 'string' } },
              descuento: { type: 'number' },
            },
            required: ['modulos'],
          },
        },
        {
          name: 'SET_ALCANCE',
          description: 'Filtra el análisis de demanda por región, país, idioma o prioridad comercial. Enviar cadena vacía en un campo lo limpia.',
          inputSchema: {
            type: 'object',
            properties: {
              region: { type: 'string' }, pais: { type: 'string' },
              idioma: { type: 'string' }, prioridad: { type: 'string' },
            },
          },
        },
        {
          name: 'VER_PESTANA',
          description: 'Abre una pestaña de la app.',
          inputSchema: {
            type: 'object',
            properties: { pestana: { type: 'string', enum: TABS.map((t) => t[0]) } },
            required: ['pestana'],
          },
        },
        {
          name: 'VER_MODULO',
          description: 'Abre el detalle de un módulo (competidores, argumentos y estrategia) por nombre exacto.',
          inputSchema: {
            type: 'object',
            properties: { app: { type: 'string', enum: D.modulos.map((m) => m.app) } },
            required: ['app'],
          },
        },
        {
          name: 'SET_TEMA',
          description: 'Cambia el modo visual del tablero: dash (estética del dashboard del estudio), estudio (compacto) o host (sigue el tema del escritorio de KIMOS).',
          inputSchema: {
            type: 'object',
            properties: { tema: { type: 'string', enum: ['dash', 'estudio', 'host'] } },
            required: ['tema'],
          },
        },
        {
          name: 'RESTAURAR_SUPUESTOS',
          description: 'Vuelve a los supuestos, descuentos, precios y cotización con los que se levantó el estudio.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'PROTOCOLO',
          description: 'Devuelve el método con el que se hace un estudio de mercado en esta app, las fuentes que sirven en el rubro del estudio en curso y la lista de lo que a este estudio todavía le falta. Léelo antes de investigar.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'NUEVO_ESTUDIO',
          description: 'Empieza el estudio de otra empresa con la estructura de su rubro. No carga ningún precio: deja el esqueleto listo para investigar. Reemplaza el estudio de esta ventana.',
          inputSchema: {
            type: 'object',
            properties: {
              plantilla: { type: 'string', enum: PLANTILLAS.map((x) => x.id) },
              empresa: { type: 'string' },
              rubro: { type: 'string' },
            },
            required: ['plantilla'],
          },
        },
        {
          name: 'SET_IDENTIDAD',
          description: 'Declara de quién es el estudio: empresa, rubro, moneda, fecha del levantamiento, autor y título.',
          inputSchema: {
            type: 'object',
            properties: {
              empresa: { type: 'string' }, rubro: { type: 'string' }, moneda: { type: 'string' },
              fecha: { type: 'string', description: 'AAAA-MM-DD' }, autor: { type: 'string' }, titulo: { type: 'string' },
            },
          },
        },
        {
          name: 'AGREGAR_LINEA',
          description: 'Añade una línea de producto o servicio al estudio, con la categoría de mercado contra la que compite.',
          inputSchema: {
            type: 'object',
            properties: {
              app: { type: 'string', description: 'Nombre de la línea' },
              cat: { type: 'string', description: 'Categoría de mercado' },
              alt: { type: 'string', description: 'Competidores de referencia, separados por coma' },
              que: { type: 'string' },
              ventaja: { type: 'number', description: 'Qué tan bien compite la empresa ahí, de 0 a 10' },
            },
            required: ['app'],
          },
        },
        {
          name: 'AGREGAR_COMPETIDOR',
          description: 'Carga un precio de la competencia en una línea del estudio. La fuente es obligatoria: sin fuente la fila no entra. Marca "Verificado" solo si el precio está publicado por el propio proveedor; si viene de un tercero que reporta contratos, marca "Estimado" y pon el rango completo en la nota.',
          inputSchema: {
            type: 'object',
            properties: {
              app: { type: 'string', description: 'Línea del estudio a la que pertenece' },
              comp: { type: 'string', description: 'Competidor' },
              plan: { type: 'string', description: 'Nombre del plan o producto' },
              precio: { type: 'number', description: 'Precio de lista mensual' },
              unidad: { type: 'string', enum: ['Plano', 'Por usuario', 'Por canal'] },
              seg: { type: 'string', enum: ['PyME / Empresa', 'Enterprise'] },
              fuente: { type: 'string', description: 'URL o documento donde está el precio' },
              conf: { type: 'string', enum: ['Verificado', 'Estimado'] },
              nota: { type: 'string' },
            },
            required: ['app', 'comp', 'plan', 'precio', 'unidad', 'seg', 'fuente', 'conf'],
          },
        },
        {
          name: 'ELIMINAR_COMPETIDOR',
          description: 'Quita un precio mal levantado, por competidor y plan.',
          inputSchema: {
            type: 'object',
            properties: { comp: { type: 'string' }, plan: { type: 'string' } },
            required: ['comp', 'plan'],
          },
        },
        {
          name: 'EXPORTAR_ESTUDIO',
          description: 'Descarga el estudio en curso como archivo JSON y devuelve su resumen. Con incluirDocumento devuelve además el estudio entero, que puede ser grande.',
          inputSchema: {
            type: 'object',
            properties: { incluirDocumento: { type: 'boolean' } },
          },
        },
        {
          name: 'IMPORTAR_ESTUDIO',
          description: 'Carga un estudio completo desde un JSON (objeto o texto). Reemplaza el estudio de esta ventana.',
          inputSchema: {
            type: 'object',
            properties: { documento: { description: 'El estudio, como objeto o como texto JSON' } },
            required: ['documento'],
          },
        },
      ],
      getSnapshot: () => {
        // Se recalcula al vuelo desde el estado actual: si dependiera del
        // último render, el agente leería cifras viejas tras cambiar supuestos.
        const of = calcularOferta(D, estado.sup, estado.desc, estado.precios);
        const dem = calcularDemanda(D, estado.sup, estado.alcance, of, estado.mix);
        const selCfg = estado.cfg.mods.filter((a) => of.byApp.has(a));
        const sumaCfg = selCfg.reduce((a, app) => a + of.byApp.get(app).sugerido, 0);
        return {
          version: APP_VERSION,
          levantamiento: D.meta.fecha,
          estudio: {
            empresa: D.meta.empresa || null,
            rubro: D.meta.rubro || null,
            moneda: D.meta.moneda,
            autor: D.meta.autor || null,
            plantilla: D.meta.plantilla || null,
            esSemillaKimos: !estado.propio,
            edadMeses: edadMeses(),
            lineas: D.modulos.map((m) => m.app),
            preciosPorLinea: D.modulos.map((m) => ({
              linea: m.app, categoria: m.cat,
              precios: D.competidores.filter((c) => c.app === m.app).length,
            })),
            faltan: huecos(),
          },
          pestana: estado.tab,
          tema: estado.tema,
          supuestos: estado.sup,
          alcance: estado.alcance,
          mixPlanes: estado.mix,
          preciosEditados: Object.keys(estado.precios).length,
          cotizacion: {
            modulos: selCfg, descuento: estado.cfg.desc,
            sumaALaCarta: sumaCfg, mensual: Math.round(sumaCfg * (1 - estado.cfg.desc)),
          },
          oferta: {
            suiteALaCarta: of.aLaCarta,
            medianaMercado: Math.round(of.medianaTotal),
            stackActualCliente: Math.round(of.stackTotal),
            kimosSobreStack: Math.round(of.ratioStack * 100) / 100,
            ahorroAnualCliente: Math.round(of.ahorroAnualStack),
            preciosVerificados: of.verificados + '/' + D.competidores.length,
            planes: of.planes.map((p) => ({ id: p.id, nombre: p.nombre, mensual: p.mensual, anual: p.anual, descuento: p.descuento })),
            kits: of.kits.map((p) => ({ id: p.id, nombre: p.nombre, mensual: p.mensual, anual: p.anual })),
            modulos: of.modulos.map((m) => ({
              app: m.app, categoria: m.cat, mediana: Math.round(m.med), sugerido: m.sugerido,
              porUsuario: m.porUsuario, cuadrante: m.cuadrante, estrategia: m.estrategia,
              alternativas: m.alt, planesLevantados: m.planes,
            })),
          },
          demanda: {
            mercados: dem.filas.length,
            mercadoSaaSMM: Math.round(dem.mercado),
            tamMM: Math.round(dem.tam),
            samMM: Math.round(dem.sam),
            indicePrecio: Math.round(dem.indice * 100) / 100,
            arpuAnual: Math.round(dem.arpuAnual),
            clientesVivosAnio3: dem.vivos[2],
            arrAnio3: dem.arr[2],
            penetracionSAM: Math.round(dem.penetracion * 10000) / 10000,
            ltv: Math.round(dem.ltv), ltvCac: Math.round(dem.ratio * 100) / 100,
            paybackMeses: Math.round(dem.payback * 10) / 10,
            topMercados: dem.filas.slice().sort((a, b) => b.sam - a.sam).slice(0, 5)
              .map((f) => ({ pais: f.pais, samMM: Math.round(f.sam), indice: f.indice, prioridad: f.prioridad })),
          },
          diagnostico: D.visual.scores.map((s) => ({ dimension: s.dim, nota: s.nota })),
          decisiones: D.decisiones.map((d) => ({ n: d.n, decision: d.decision, hacer: d.hacer, impacto: d.impacto })),
        };
      },
      dispatchAction: async (action) => {
        const t = action && action.type;
        const p = (action && action.payload) || {};
        try {
          if (t === 'SET_SUPUESTO') {
            if (CLAVES_SUP.indexOf(p.clave) < 0) return { success: false, error: 'Supuesto desconocido: ' + p.clave };
            const v = Number(p.valor);
            if (!isFinite(v) || v < 0) return { success: false, error: 'Valor inválido' };
            setSup(p.clave, v);
            return { success: true, message: p.clave + ' = ' + v };
          }
          if (t === 'SET_DESCUENTO_PLAN') {
            if (!(p.plan in descBase(D))) return { success: false, error: 'Plan desconocido: ' + p.plan };
            const v = Number(p.descuento);
            if (!isFinite(v) || v < 0 || v > 0.95) return { success: false, error: 'El descuento debe ir entre 0 y 0,95' };
            setDesc(p.plan, v);
            return { success: true, message: p.plan + ' con ' + Math.round(v * 100) + '% de descuento' };
          }
          if (t === 'SET_PRECIO_COMPETIDOR') {
            const v = Number(p.precio);
            if (!isFinite(v) || v < 0) return { success: false, error: 'Precio inválido' };
            const i = D.competidores.findIndex((c) => c.comp === p.competidor && c.plan === p.plan);
            if (i < 0) return { success: false, error: 'No existe el plan ' + p.plan + ' de ' + p.competidor };
            setPrecio(i, v);
            return { success: true, message: p.competidor + ' ' + p.plan + ' = ' + usd1(v) + '/mes' };
          }
          if (t === 'COTIZAR') {
            const validos = (Array.isArray(p.modulos) ? p.modulos : []).filter((a) => D.modulos.some((m) => m.app === a));
            if (!validos.length) return { success: false, error: 'Ningún módulo válido. Usa los nombres exactos de las apps.' };
            const d = Number(p.descuento);
            const cfg = { mods: validos, desc: isFinite(d) && d >= 0 && d <= 0.95 ? d : estado.cfg.desc };
            commit({ tab: 'configurador', cfg: cfg });
            const of = calcularOferta(D, estado.sup, estado.desc, estado.precios);
            const suma = validos.reduce((a, app) => a + of.byApp.get(app).sugerido, 0);
            return { success: true, message: validos.length + ' módulos · ' + usd(Math.round(suma * (1 - cfg.desc))) + '/mes' };
          }
          if (t === 'SET_ALCANCE') {
            const a = { region: '', idioma: '', prioridad: '', pais: '' };
            ['region', 'idioma', 'prioridad', 'pais'].forEach((k) => {
              if (typeof p[k] === 'string') a[k] = p[k];
            });
            if (a.pais && !D.demanda.paises.some((x) => x.pais === a.pais)) {
              return { success: false, error: 'País desconocido: ' + a.pais };
            }
            if (a.pais) { a.region = ''; a.idioma = ''; a.prioridad = ''; }
            const n = paisesEnAlcance(D, a).length;
            if (!n) return { success: false, error: 'Ese alcance no deja ningún mercado dentro' };
            commit({ alcance: a });
            return { success: true, message: n + ' mercados en el alcance' };
          }
          if (t === 'VER_PESTANA') {
            if (!TABS.some((x) => x[0] === p.pestana)) return { success: false, error: 'Pestaña desconocida' };
            commit({ tab: p.pestana });
            return { success: true, message: 'Pestaña ' + p.pestana };
          }
          if (t === 'VER_MODULO') {
            const m = D.modulos.filter((x) => x.app === p.app)[0];
            if (!m) return { success: false, error: 'Módulo desconocido: ' + p.app };
            commit({ tab: 'mapa', modSel: m.n });
            return { success: true, message: 'Detalle de ' + m.app };
          }
          if (t === 'SET_TEMA') {
            if (!TEMAS.some((x) => x[0] === p.tema)) return { success: false, error: 'Modo desconocido: ' + p.tema };
            commit({ tema: p.tema, menuTema: false });
            return { success: true, message: 'Modo ' + p.tema };
          }
          if (t === 'RESTAURAR_SUPUESTOS') {
            commit({
              sup: supBase(D), desc: descBase(D),
              mix: mixBase(D), precios: {}, cfg: { mods: [], desc: 0.5 },
            });
            return { success: true, message: 'Supuestos del estudio restaurados' };
          }
          if (t === 'PROTOCOLO') {
            const plant = PLANTILLAS.filter((x) => x.id === D.meta.plantilla)[0];
            return {
              success: true,
              message: 'Protocolo del estudio en ' + PROTOCOLO.length + ' pasos',
              data: {
                pasos: PROTOCOLO.map((x) => ({ n: x.n, titulo: x.titulo, texto: x.texto })),
                fuentesDelRubro: plant ? plant.fuentes : [],
                rubro: D.meta.rubro || null,
                reglaDeOro: 'Un precio sin fuente no entra. Verificado es solo el precio publicado por el propio proveedor; todo lo demás es Estimado y lleva el rango en la nota.',
                faltan: huecos(),
              },
            };
          }
          if (t === 'NUEVO_ESTUDIO') {
            if (!PLANTILLAS.some((x) => x.id === p.plantilla)) {
              return { success: false, error: 'Plantilla desconocida. Usa: ' + PLANTILLAS.map((x) => x.id).join(', ') };
            }
            nuevoEstudio(p.plantilla, p.empresa || '');
            if (p.rubro) setMeta('rubro', p.rubro);
            return {
              success: true,
              message: 'Estudio nuevo de ' + (p.empresa || 'empresa sin nombre') + ' con la plantilla ' + p.plantilla
                + '. Tiene ' + D.modulos.length + ' líneas y ningún precio: toca investigarlos y cargarlos con AGREGAR_COMPETIDOR.',
              data: { lineas: D.modulos.map((m) => ({ linea: m.app, categoria: m.cat, referencias: m.alt })) },
            };
          }
          if (t === 'SET_IDENTIDAD') {
            const campos = ['empresa', 'rubro', 'moneda', 'fecha', 'autor', 'titulo'];
            const puestos = campos.filter((k) => typeof p[k] === 'string' && p[k] !== '');
            if (!puestos.length) return { success: false, error: 'No hay nada que cambiar. Campos: ' + campos.join(', ') };
            if (p.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) return { success: false, error: 'La fecha va como AAAA-MM-DD' };
            puestos.forEach((k) => setMeta(k, p[k]));
            return { success: true, message: 'Identidad actualizada: ' + puestos.join(', ') };
          }
          if (t === 'AGREGAR_LINEA') {
            const err = agregarLinea(p);
            if (err) return { success: false, error: err };
            return { success: true, message: 'Línea "' + p.app + '" añadida. Ahora cárgale precios con AGREGAR_COMPETIDOR.' };
          }
          if (t === 'AGREGAR_COMPETIDOR') {
            const err = agregarCompetidor(p);
            if (err) return { success: false, error: err };
            const of = calcularOferta(D, estado.sup, estado.desc, estado.precios);
            const m = of.byApp.get(p.app);
            return {
              success: true,
              message: p.comp + ' · ' + p.plan + ' cargado en ' + p.app + '.',
              data: m ? { linea: m.app, precios: m.planes, mediana: Math.round(m.med), sugerido: m.sugerido } : null,
            };
          }
          if (t === 'ELIMINAR_COMPETIDOR') {
            const i = D.competidores.findIndex((c) => c.comp === p.comp && c.plan === p.plan);
            if (i < 0) return { success: false, error: 'No existe el plan ' + p.plan + ' de ' + p.comp };
            borrarCompetidor(i);
            return { success: true, message: 'Quitado ' + p.comp + ' · ' + p.plan };
          }
          if (t === 'EXPORTAR_ESTUDIO') {
            exportarEstudio();
            const resumen = {
              empresa: D.meta.empresa || null, rubro: D.meta.rubro || null, fecha: D.meta.fecha,
              lineas: D.modulos.length, precios: D.competidores.length,
              verificados: D.competidores.filter((c) => c.conf === 'Verificado').length,
            };
            if (p.incluirDocumento) resumen.documento = clon(D);
            return { success: true, message: 'Estudio exportado como JSON', data: resumen };
          }
          if (t === 'IMPORTAR_ESTUDIO') {
            const doc = typeof p.documento === 'string' ? p.documento : JSON.stringify(p.documento);
            const err = importarEstudio(doc);
            if (err) return { success: false, error: err };
            return {
              success: true,
              message: 'Estudio importado: ' + (D.meta.empresa || 'sin nombre') + ' · ' + D.modulos.length
                + ' líneas · ' + D.competidores.length + ' precios',
            };
          }
          return { success: false, error: 'Acción no soportada: ' + t };
        } catch (e) {
          return { success: false, error: String((e && e.message) || e) };
        }
      },
    });
  }

  if (shell && shell.window && typeof shell.window.setTitle === 'function') {
    try { shell.window.setTitle('Estudio de Mercado'); } catch (e) { /* opcional */ }
  }
  restaurar();

  return {
    Component: Component,
    unmount() {
      if (timer) { clearTimeout(timer); timer = null; }
      oyentes.clear();
      if (typeof desregistrar === 'function') { try { desregistrar(); } catch (e) { /* ya desregistrado */ } }
    },
  };
}
