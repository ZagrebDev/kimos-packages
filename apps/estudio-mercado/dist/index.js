/**
 * Estudio de Mercado — app instalable de KIMOS.
 *
 * Bundle ESM autocontenido: usa globalThis.React (nunca su propia copia) y
 * React.createElement (el host no compila JSX). Los datos del estudio viven en
 * src/data.json y `build.mjs` los inyecta donde dice DATOS_INLINE.
 *
 * Todo número visible se recalcula desde los supuestos editables: no hay
 * resultados congelados. Esa es la diferencia con la planilla original.
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.0.0';

const DATA = {"meta":{"fecha":"2026-08-16","moneda":"USD","fuente":"KIMOS - Estudio de mercado y modelo de precios (planilla + dashboard, ago-2026)"},"supuestos":{"usuarios":10,"canales":5,"factor":0.55,"descAnual":0.2},"modulos":[{"n":1,"app":"Escritorio Kimos","que":"Control del escritorio, apertura de aplicaciones y chat entre agentes","cat":"AI Workspace / agente de escritorio","alt":"ChatGPT Business, Claude Team, M365 Copilot, Manus","target":"Toda la base instalada","pro":"Es el único módulo que ningún competidor replica dentro de una suite: los demás venden el asistente aparte de las apps. Orquestar agentes sobre datos propios elimina el copy-paste entre herramientas.","contra":"Compite contra OpenAI y Microsoft, que subsidian el precio. La calidad depende de modelos de terceros: si sube el costo del token, sube tu costo variable y no lo controlas.","estrategia":"Ancla de la suite: incluir en todos los planes, nunca vender suelto","conf":"4/5","ventaja":8},{"n":2,"app":"Agentes","que":"Agentes IA internos que ejecutan tareas del negocio","cat":"Constructor de agentes IA","alt":"Zapier, Lindy, Relevance AI, Notion Agents","target":"Equipos de operaciones","pro":"Los agentes ya viven donde están los datos (CRM, archivos, productos). Zapier y Lindy tienen que conectarse por API a todo y pagan ese costo en latencia y fragilidad.","contra":"Categoría con el ciclo de innovación más rápido del mercado y jugadores con capital ilimitado. El costo por crédito es difícil de proyectar y erosiona margen si se subestima.","estrategia":"Base fija baja + cobro por créditos de consumo","conf":"6/6","ventaja":6},{"n":3,"app":"Agentes Web","que":"Chatbots y vendedores web (ej. vendedor_figit.ai)","cat":"Chatbot / agente conversacional web","alt":"Tidio, Intercom Fin, Chatbase, Crisp, ManyChat","target":"E-commerce y equipos de soporte","pro":"El bot conoce el catálogo real (módulo Productos) y el pipeline (Prospección), no un PDF cargado a mano. Ese contexto es exactamente lo que Chatbase no puede dar.","contra":"Intercom domina el segmento medio-alto con una marca enorme y Tidio el bajo con precio agresivo. Sin volumen de conversaciones, el modelo por resolución de Intercom sale más barato.","estrategia":"Módulo premium: alto valor percibido y ROI demostrable","conf":"9/9","ventaja":7},{"n":4,"app":"Archivos","que":"Gestor documental de la organización","cat":"Almacenamiento y gestión documental","alt":"Google Workspace, Dropbox Business, Box, Egnyte","target":"Toda la base instalada","pro":"Los archivos quedan junto a las tareas, productos y clientes que los originan, sin una capa de integración de por medio.","contra":"Es la categoría más comoditizada que existe y compite contra almacenamiento a escala de Google. Nadie cambia de proveedor de archivos por si solo: solo migra si migra todo.","estrategia":"Commodity: incluir en el core, jamás vender suelto","conf":"7/7","ventaja":2},{"n":5,"app":"Conocimiento","que":"Base de conocimiento corporativa","cat":"Knowledge base / wiki con IA","alt":"Confluence, Guru, Slite, Notion, Document360","target":"Equipos de 10+ personas","pro":"La búsqueda alimenta directamente a los agentes: el conocimiento no es un repositorio muerto sino el contexto que consume el resto de la suite.","contra":"Notion y Confluence tienen ecosistemas de plantillas y comunidades que tomaron una década construir. Migrar documentación es doloroso y frena la venta.","estrategia":"Incluir en el core; diferenciar con búsqueda IA nativa","conf":"5/5","ventaja":4},{"n":6,"app":"Equipos","que":"Colaboración y comunicación por equipo","cat":"Colaboración / chat de equipo","alt":"Slack, Microsoft Teams, Google Chat","target":"Toda la base instalada","pro":"Conversación pegada al trabajo, sin saltar entre Slack y el gestor de tareas.","contra":"Es la categoría más difícil de desplazar del mercado: el chat tiene efecto de red y Teams viene gratis con Microsoft 365. Recomendación honesta: no pelear aquí, integrarse.","estrategia":"Commodity: incluir en el core","conf":"5/5","ventaja":1},{"n":7,"app":"Kanban","que":"Tableros de tareas y flujos de trabajo","cat":"Gestión de tareas Kanban","alt":"Trello, ClickUp, Monday.com, Asana, Jira","target":"Todos los equipos","pro":"Funcionalidad de paridad razonable y es el módulo más fácil de adoptar sin capacitación. Buen caballo de Troya para entrar a la cuenta.","contra":"Mercado saturado con Trello a USD 5 y ClickUp a USD 7. Cero disposición a pagar más que el líder, y el costo de cambio para el cliente es bajísimo.","estrategia":"Módulo de entrada con precio agresivo: sirve para adquirir, no para monetizar","conf":"9/9","ventaja":3},{"n":8,"app":"Planificación (Gantt)","que":"Planificación de proyectos en diagrama de Gantt","cat":"Planificación de proyectos / Gantt","alt":"Smartsheet, Wrike, MS Project, TeamGantt, Instagantt","target":"PMOs y consultoras","pro":"Vendido junto a Kanban da una propuesta que Trello no tiene y Smartsheet cobra a USD 19.","contra":"MS Project es el estándar de facto en organizaciones grandes por inercia. Gantt suelto es un producto de nicho: casi nadie lo compra aislado.","estrategia":"Vender empaquetado con Kanban como módulo único de gestión de proyectos","conf":"8/8","ventaja":4},{"n":9,"app":"Notas de Equipo","que":"Notas colaborativas y seguimiento de modificaciones","cat":"Notas colaborativas / docs","alt":"Notion, Coda, Evernote Teams, Slite","target":"Toda la base instalada","pro":"Las notas se vinculan a tareas y clientes reales en vez de vivir en un documento aislado.","contra":"Notion define la categoría y tiene una comunidad gigantesca de plantillas. Competir de frente en features de documento es una batalla pérdida.","estrategia":"Incluir en el core","conf":"5/5","ventaja":3},{"n":10,"app":"HTML Panel / Dashboards","que":"Paneles HTML personalizados (BSC, análisis estratégico)","cat":"Dashboards y paneles embebidos","alt":"Retool, Power BI, Tableau, Geckoboard","target":"Gerencia y dirección","pro":"Los datos ya están dentro de la suite: no hay ETL ni conectores que mantener. Power BI necesita una capa de integración completa para llegar a lo mismo.","contra":"Power BI a USD 14 con el peso de Microsoft detras es difícil de superar en percepción. Requiere perfiles técnicos para armar los paneles y eso encarece el onboarding.","estrategia":"Diferenciador técnico: módulo premium con servicios de implementación","conf":"7/7","ventaja":6},{"n":11,"app":"FossFLOW (BPM)","que":"Gestión y automatización de procesos de negocio, con supervisión por etapa","cat":"BPM / automatización de procesos","alt":"Pipefy, Kissflow, Nintex, Process Street, monday.com","target":"Empresas con procesos regulados","pro":"Categoría con precios altos y competidores caros o pesados: Kissflow parte en USD 2.500/mes de plataforma y Nintex en USD 1.405. Hay mucho espacio para entrar por debajo con algo usable.","contra":"Es el módulo más difícil de construir bien: motor de reglas, versionado, auditoría y cumplimiento. Vender BPM exige consultoría y ciclos de venta largos.","estrategia":"Módulo premium: es donde el ticket sube sin resistencia","conf":"5/6","ventaja":7},{"n":12,"app":"Digitai (automatización IA)","que":"Gestión y automatización de tareas de IA y procesamiento de datos","cat":"Automatización IA / orquestación de datos","alt":"Dify, Flowise, n8n, Relevance AI","target":"Equipos técnicos","pro":"Complementa a los Agentes con el pipeline de datos que los alimenta. Precios de referencia razonables (Dify USD 59, n8n USD 24) dejan margen.","contra":"Se solapa fuerte con el módulo Agentes: dos productos que el cliente percibe como uno. Además compite contra open source gratuito y autohospedable, que es un techo de precio duro.","estrategia":"Cobro por consumo; evaluar fusionarlo con Agentes","conf":"5/6","ventaja":4},{"n":13,"app":"Formularios de Contacto","que":"Administración de formularios de contacto","cat":"Formularios y captura de leads","alt":"Typeform, Jotform, Tally, Fillout","target":"Marketing y ventas","pro":"El lead entra directo al CRM sin Zapier de por medio. Typeform cobra USD 29 solo por 100 respuestas al mes.","contra":"Tally regala respuestas ilimitadas en su plan free: el piso de precio de la categoría tiende a cero. No es un módulo del que se pueda vivir.","estrategia":"Gancho de entrada freemium con límite de respuestas","conf":"8/8","ventaja":3},{"n":14,"app":"Prospección Comercial","que":"Gestión y seguimiento de prospección de clientes","cat":"CRM / prospección de ventas","alt":"Pipedrive, HubSpot, Apollo.io, Salesforce","target":"Equipos comerciales","pro":"Es donde el cliente ya acepta pagar USD 39-100 por asiento. Integrado con Agentes Web y Formularios cierra el ciclo completo de lead a venta, algo que Pipedrive solo hace comprando add-ons.","contra":"Categoría con costo de cambio altísimo: nadie migra su CRM a la ligera. Salesforce y HubSpot tienen ecosistemas de partners que KIMOS no puede igualar en el corto plazo.","estrategia":"El módulo con mayor disposición a pagar de toda la suite","conf":"12/12","ventaja":7},{"n":15,"app":"Social Planner","que":"Planificación de contenido en redes sociales","cat":"Gestión y programación de redes","alt":"Buffer, Hootsuite, Metricool, Later, Sprout Social","target":"Marketing y agencias","pro":"Junto a Kreative Studio cubre crear y publicar en un solo lugar; Buffer y Hootsuite solo publican.","contra":"Depende de APIs de terceros (Meta, TikTok, LinkedIn) que cambian sin aviso y obligan a mantenimiento constante. Metricool a USD 18 fija un techo bajo.","estrategia":"Cobrar por canal conectado, nunca por usuario","conf":"7/7","ventaja":4},{"n":16,"app":"Kreative Studio","que":"Creación de contenido visual: posts, banners, logos y material gráfico","cat":"Diseño gráfico / contenido visual","alt":"Canva, Adobe Express, Figma, VistaCreate","target":"Marketing y disenadores","pro":"El diseño conectado al catálogo de productos y al calendario de publicación es un flujo que Canva no tiene cerrado.","contra":"Canva tiene 200+ millones de usuarios, una biblioteca de plantillas imposible de replicar y cobra USD 10. Competir en features de diseño puro no es realista.","estrategia":"Vender junto a Social Planner como paquete de marketing","conf":"3/4","ventaja":3},{"n":17,"app":"Kimos FunPlai (gamificación)","que":"Gamificación y experiencias interactivas: juegos, concursos y actividades lúdicas","cat":"Gamificación y engagement","alt":"Kahoot!, Spinify, Mentimeter, TalentLMS, Gametize","target":"RRHH, marketing y eventos","pro":"Categoría fragmentada y sin líder claro en el mundo hispano. Conectado a Equipos y Eventos permite gamificar procesos internos reales, no solo trivias sueltas.","contra":"Uso episódico: la gente lo usa para una campaña y lo abandona, lo que produce churn alto si se cobra mensual. Kahoot domina el reconocimiento de marca en lo educativo.","estrategia":"Add-on por campaña o por evento, no suscripción mensual fija","conf":"4/6","ventaja":5},{"n":18,"app":"ProductLab","que":"Gestión de producto, investigación y desarrollo","cat":"Product management / roadmap","alt":"Productboard, Aha!, Airfocus, Jira Product Discovery","target":"Empresas con equipo de producto","pro":"Precios de referencia altos (Productboard Pro USD 80, Aha! USD 59) y competidores percibidos como caros y complejos.","contra":"Nicho estrecho: solo lo compran empresas con equipo de producto formal. En Latinoamérica ese perfil es escaso y alarga el ciclo de venta.","estrategia":"Nicho de ticket alto: pocos asientos, precio elevado por asiento","conf":"7/7","ventaja":5},{"n":19,"app":"Productos (PIM)","que":"Gestión de catálogos de productos","cat":"PIM / catálogo de productos","alt":"Plytix, Akeneo, Salsify, Sales Layer","target":"Retail, distribución y manufactura","pro":"La brecha de precio es enorme: Plytix cobra USD 499 y Akeneo parte en USD 45.000 al año. Integrado con Tienda y Vitrina, KIMOS cubre el ciclo entero que Plytix vende como add-ons de USD 300 cada uno.","contra":"PIM es intensivo en calidad de datos y migración: el proyecto se juega en la implementación, no en el software. Exige un equipo de soporte técnico sólido.","estrategia":"Tarifa plana por volumen de SKU con asientos ilimitados","conf":"4/5","ventaja":8},{"n":20,"app":"Tienda (e-commerce)","que":"Tienda en línea","cat":"E-commerce / storefront","alt":"Shopify, BigCommerce, Wix, WooCommerce","target":"Retail y PyMEs con venta online","pro":"Con PIM y Vitrina integrados, la tienda se alimenta sola desde el catálogo maestro.","contra":"Shopify es un monopolio blando con un app store de miles de integraciones. Sin ese ecosistema, la tienda de KIMOS será funcionalmente más pobre por varios años. Recomendación honesta: integrarse con Shopify antes que competirle.","estrategia":"Tarifa plana; evaluar comisión sobre GMV solo en tiers bajos","conf":"7/7","ventaja":2},{"n":21,"app":"Vitrina (catálogo digital)","que":"Vitrina pública de productos y marca","cat":"Catálogo digital / brand portal","alt":"Linktree, Flipsnack, Plytix Brand Portals","target":"Retail y marcas","pro":"Plytix cobra USD 300 por el mismo add-on. Como complemento del PIM es margen casi puro.","contra":"Es una feature, no un producto: nadie contrata una suite por su vitrina. Vendida suelta compite con Linktree a USD 9.","estrategia":"Add-on económico sobre Productos o Tienda","conf":"1/5","ventaja":5},{"n":22,"app":"KIMOS Cashflow","que":"Gestión del flujo de caja","cat":"Gestión y proyección de flujo de caja","alt":"Float, Fathom, Agicap, Dryrun","target":"Gerencia financiera y PyMEs","pro":"Categoría con precios sanos (Float USD 49-199, Fathom hasta USD 260) y competidores extranjeros con poca adaptación tributaria local.","contra":"Exige integración con bancos y ERPs locales para ser útil de verdad, y eso es trabajo país por país. Sin conciliación automática queda en una planilla bonita.","estrategia":"Tarifa plana por empresa, nunca por usuario","conf":"5/6","ventaja":6},{"n":23,"app":"Gestión de Eventos","que":"Gestión de eventos corporativos (Desayuno Ciberseguridad 2026)","cat":"Gestión de eventos","alt":"Luma, Eventbrite, Bizzabo, Cvent","target":"Marketing corporativo","pro":"El evento se conecta al CRM y a los formularios: los asistentes se vuelven leads automáticamente. Bizzabo cobra USD 499 por usuario para hacer eso mismo.","contra":"Uso estacional con churn natural. Luma es gratis y muy bueno para eventos chicos, lo que aplasta el precio en el segmento de entrada.","estrategia":"Cobrar por evento o campaña, no como suscripción mensual","conf":"3/5","ventaja":4},{"n":24,"app":"Integraciones","que":"Conexión con sistemas externos","cat":"iPaaS / automatización","alt":"Zapier, Make, n8n","target":"Toda la base instalada","pro":"Al vivir dentro de la suite evita el costo de conectar cada app entre si, que es justamente el problema que Zapier existe para resolver.","contra":"Make cobra USD 9 por 10.000 operaciones y n8n es gratis autohospedado. El techo de precio es muy bajo y el valor solo aparece hacia afuera de la suite.","estrategia":"Incluir en el core y cobrar por volumen de ejecuciones","conf":"4/4","ventaja":3}],"competidores":[{"row":0,"app":"Escritorio Kimos","comp":"ChatGPT Business","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Enterprise ~USD 60/asiento","fuente":"coworker.ai/blog/chatgpt-enterprise-pricing","conf":"Verificado"},{"row":1,"app":"Escritorio Kimos","comp":"ChatGPT Team","plan":"Team","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"coworker.ai/blog/chatgpt-enterprise-pricing","conf":"Verificado"},{"row":2,"app":"Escritorio Kimos","comp":"Claude Team","plan":"Team","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 5 asientos","fuente":"fusioncomputing.ca/copilot-vs-chatgpt-vs-claude","conf":"Verificado"},{"row":3,"app":"Escritorio Kimos","comp":"Microsoft 365 Copilot","plan":"Business","precio":21,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 18 promocional hasta sep-2026; exige licencia M365","fuente":"geotoolbox.ai/blog/copilot-pricing","conf":"Verificado"},{"row":4,"app":"Escritorio Kimos","comp":"Manus","plan":"Starter","precio":19,"unidad":"Plano","seg":"PyME / Empresa","nota":"Agente autónomo por créditos","fuente":"manus.im/pricing","conf":"Estimado"},{"row":5,"app":"Agentes","comp":"Zapier","plan":"Professional","precio":19.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"Free con 100 tareas/mes","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":6,"app":"Agentes","comp":"Zapier","plan":"Team","precio":69,"unidad":"Plano","seg":"PyME / Empresa","nota":"Usuarios ilimitados","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":7,"app":"Agentes","comp":"Lindy","plan":"Plus","precio":49.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"Cobro por créditos, sobreconsumo al doble","fuente":"coworker.ai/blog/lindy-ai-pricing","conf":"Verificado"},{"row":8,"app":"Agentes","comp":"Lindy","plan":"Pro","precio":99.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"coworker.ai/blog/lindy-ai-pricing","conf":"Verificado"},{"row":9,"app":"Agentes","comp":"Lindy","plan":"Max","precio":199.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"coworker.ai/blog/lindy-ai-pricing","conf":"Verificado"},{"row":10,"app":"Agentes","comp":"Notion","plan":"Business (Agents)","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Agentes custom: USD 10 / 1.000 créditos","fuente":"notion.com/pricing","conf":"Verificado"},{"row":11,"app":"Agentes Web","comp":"Tidio","plan":"Starter","precio":24.17,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tidio.com/pricing","conf":"Verificado"},{"row":12,"app":"Agentes Web","comp":"Tidio","plan":"Growth","precio":49.17,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tidio.com/pricing","conf":"Verificado"},{"row":13,"app":"Agentes Web","comp":"Tidio","plan":"Plus","precio":300,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tidio.com/pricing","conf":"Verificado"},{"row":14,"app":"Agentes Web","comp":"Intercom","plan":"Essential","precio":29,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Fin AI: USD 0,99 por resolución","fuente":"flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison","conf":"Verificado"},{"row":15,"app":"Agentes Web","comp":"Intercom","plan":"Advanced","precio":85,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Incluye 20 asientos Lite","fuente":"flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison","conf":"Verificado"},{"row":16,"app":"Agentes Web","comp":"Intercom","plan":"Expert","precio":132,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison","conf":"Verificado"},{"row":17,"app":"Agentes Web","comp":"Chatbase","plan":"Standard","precio":120,"unidad":"Plano","seg":"PyME / Empresa","nota":"4.000 créditos; sobrecosto USD 40/1.000","fuente":"blog.fastbots.ai/ai-chatbot-pricing-comparison","conf":"Verificado"},{"row":18,"app":"Agentes Web","comp":"Crisp","plan":"Essentials","precio":103,"unidad":"Plano","seg":"PyME / Empresa","nota":"EUR 95 convertidos","fuente":"featurebase.app/blog/crisp-vs-intercom","conf":"Verificado"},{"row":19,"app":"Agentes Web","comp":"ManyChat","plan":"Pro","precio":14,"unidad":"Plano","seg":"PyME / Empresa","nota":"250 contactos activos; USD 139 con 25.000","fuente":"elfsight.com/blog/how-much-does-a-chatbot-cost","conf":"Verificado"},{"row":20,"app":"Archivos","comp":"Google Workspace","plan":"Business Starter","precio":7,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"30 GB por usuario","fuente":"workspace.google.com/pricing","conf":"Verificado"},{"row":21,"app":"Archivos","comp":"Google Workspace","plan":"Business Standard","precio":14,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"2 TB por usuario","fuente":"workspace.google.com/pricing","conf":"Verificado"},{"row":22,"app":"Archivos","comp":"Google Workspace","plan":"Business Plus","precio":22,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"5 TB por usuario","fuente":"workspace.google.com/pricing","conf":"Verificado"},{"row":23,"app":"Archivos","comp":"Dropbox Business","plan":"Standard","precio":15,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"5 TB compartidos","fuente":"costbench.com/software/document-management/dropbox-business","conf":"Verificado"},{"row":24,"app":"Archivos","comp":"Dropbox Business","plan":"Advanced","precio":24,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Almacenamiento ilimitado","fuente":"costbench.com/software/document-management/dropbox-business","conf":"Verificado"},{"row":25,"app":"Archivos","comp":"Egnyte","plan":"Business","precio":22,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"egnyte.com/pricing","conf":"Verificado"},{"row":26,"app":"Archivos","comp":"Box","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 25 con pago mensual","fuente":"bestcloudstorageguide.com/blog/box-pricing","conf":"Verificado"},{"row":27,"app":"Conocimiento","comp":"Confluence","plan":"Standard","precio":5.42,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"docsie.io/blog/articles/confluence-vs-document360-pricing-comparison-2026","conf":"Verificado"},{"row":28,"app":"Conocimiento","comp":"Guru","plan":"All-in-one","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 10 asientos","fuente":"usecarly.com/blog/guru-alternatives","conf":"Verificado"},{"row":29,"app":"Conocimiento","comp":"Slite","plan":"Standard","precio":8,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"slite.com/learn/knowledge-base-softwares","conf":"Verificado"},{"row":30,"app":"Conocimiento","comp":"Notion","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Incluye Enterprise Search","fuente":"notion.com/pricing","conf":"Verificado"},{"row":31,"app":"Conocimiento","comp":"Document360","plan":"Professional","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"Rango 199-499 según uso de IA","fuente":"docsie.io/blog/articles/confluence-vs-document360-pricing-comparison-2026","conf":"Verificado"},{"row":32,"app":"Equipos","comp":"Slack","plan":"Pro","precio":7.25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"costbench.com/software/communication/slack","conf":"Verificado"},{"row":33,"app":"Equipos","comp":"Slack","plan":"Business+","precio":12.5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"costbench.com/software/communication/slack","conf":"Verificado"},{"row":34,"app":"Equipos","comp":"Microsoft Teams","plan":"Essentials","precio":4,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Sube a USD 4,50 en jul-2026","fuente":"getpricepulse.com/companies/slack-vs-microsoft-teams-pricing","conf":"Verificado"},{"row":35,"app":"Equipos","comp":"Microsoft 365","plan":"Business Basic","precio":6,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Teams + Office web","fuente":"getpricepulse.com/companies/slack-vs-microsoft-teams-pricing","conf":"Verificado"},{"row":36,"app":"Equipos","comp":"Microsoft 365","plan":"Business Standard","precio":12.5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Incluye Office escritorio","fuente":"getpricepulse.com/companies/slack-vs-microsoft-teams-pricing","conf":"Verificado"},{"row":37,"app":"Kanban","comp":"Trello","plan":"Standard","precio":5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"costbench.com/software/project-management/trello","conf":"Verificado"},{"row":38,"app":"Kanban","comp":"Trello","plan":"Premium","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"costbench.com/software/project-management/trello","conf":"Verificado"},{"row":39,"app":"Kanban","comp":"Trello","plan":"Enterprise","precio":17.5,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 50 asientos","fuente":"costbench.com/software/project-management/trello","conf":"Verificado"},{"row":40,"app":"Kanban","comp":"ClickUp","plan":"Unlimited","precio":7,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"layer3labs.io/guides/clickup-pricing","conf":"Verificado"},{"row":41,"app":"Kanban","comp":"ClickUp","plan":"Business","precio":12,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"layer3labs.io/guides/clickup-pricing","conf":"Verificado"},{"row":42,"app":"Kanban","comp":"ClickUp","plan":"Business Plus","precio":19,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"layer3labs.io/guides/clickup-pricing","conf":"Verificado"},{"row":43,"app":"Kanban","comp":"Monday.com","plan":"Basic","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 3 asientos","fuente":"softwarefinder.com/resources/trello-vs-asana-vs-monday-vs-clickup","conf":"Verificado"},{"row":44,"app":"Kanban","comp":"Asana","plan":"Starter","precio":13.49,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"softwarefinder.com/resources/trello-vs-asana-vs-monday-vs-clickup","conf":"Verificado"},{"row":45,"app":"Kanban","comp":"Asana","plan":"Advanced","precio":24.99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Se factura en bloques de 5","fuente":"plutio.com/compare/asana-vs-wrike","conf":"Verificado"},{"row":46,"app":"Planificación (Gantt)","comp":"Smartsheet","plan":"Pro","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"tech.co/project-management-software/smartsheet-pricing","conf":"Verificado"},{"row":47,"app":"Planificación (Gantt)","comp":"Smartsheet","plan":"Business","precio":19,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"tech.co/project-management-software/smartsheet-pricing","conf":"Verificado"},{"row":48,"app":"Planificación (Gantt)","comp":"Wrike","plan":"Team","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"2 a 15 usuarios","fuente":"costbench.com/software/project-management/wrike","conf":"Verificado"},{"row":49,"app":"Planificación (Gantt)","comp":"Wrike","plan":"Business","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Mínimo 5 asientos","fuente":"costbench.com/software/project-management/wrike","conf":"Verificado"},{"row":50,"app":"Planificación (Gantt)","comp":"Microsoft Project","plan":"Plan 1","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"techrepublic.com/article/microsoft-project-vs-smartsheet","conf":"Verificado"},{"row":51,"app":"Planificación (Gantt)","comp":"Microsoft Project","plan":"Plan 3","precio":30,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Tier real para gestión de recursos","fuente":"techrepublic.com/article/microsoft-project-vs-smartsheet","conf":"Verificado"},{"row":52,"app":"Planificación (Gantt)","comp":"Instagantt","plan":"Team","precio":20,"unidad":"Plano","seg":"PyME / Empresa","nota":"USD 240/ano, 3 colaboradores incluidos","fuente":"wrike.com/blog/best-gantt-chart-software-online","conf":"Verificado"},{"row":53,"app":"Planificación (Gantt)","comp":"TeamGantt","plan":"Lite","precio":19,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/teamgantt-vs-wrike","conf":"Verificado"},{"row":54,"app":"Notas de Equipo","comp":"Notion","plan":"Plus","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"notion.com/pricing","conf":"Verificado"},{"row":55,"app":"Notas de Equipo","comp":"Notion","plan":"Business","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"notion.com/pricing","conf":"Verificado"},{"row":56,"app":"Notas de Equipo","comp":"Coda","plan":"Pro","precio":12,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Solo Doc Makers pagan","fuente":"vendr.com/marketplace/coda","conf":"Verificado"},{"row":57,"app":"Notas de Equipo","comp":"Coda","plan":"Team","precio":36,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"vendr.com/marketplace/coda","conf":"Verificado"},{"row":58,"app":"Notas de Equipo","comp":"Slite","plan":"Standard","precio":8,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"slite.com/learn/knowledge-base-softwares","conf":"Verificado"},{"row":59,"app":"HTML Panel / Dashboards","comp":"Retool","plan":"Team","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Más USD 5 por usuario interno","fuente":"jetadmin.io/blog/retool-pricing-explained-2026","conf":"Verificado"},{"row":60,"app":"HTML Panel / Dashboards","comp":"Retool","plan":"Business","precio":50,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Más USD 15 por usuario interno","fuente":"jetadmin.io/blog/retool-pricing-explained-2026","conf":"Verificado"},{"row":61,"app":"HTML Panel / Dashboards","comp":"Power BI","plan":"Pro","precio":14,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"toucantoco.com/en/blog/power-bi-pricing","conf":"Verificado"},{"row":62,"app":"HTML Panel / Dashboards","comp":"Power BI","plan":"Premium por usuario","precio":24,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"toucantoco.com/en/blog/power-bi-pricing","conf":"Verificado"},{"row":63,"app":"HTML Panel / Dashboards","comp":"Tableau","plan":"Viewer","precio":15,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"costbench.com/software/business-intelligence/tableau","conf":"Verificado"},{"row":64,"app":"HTML Panel / Dashboards","comp":"Tableau","plan":"Creator","precio":75,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"costbench.com/software/business-intelligence/tableau","conf":"Verificado"},{"row":65,"app":"HTML Panel / Dashboards","comp":"Geckoboard","plan":"Essential","precio":29,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"itqlick.com/geckoboard/pricing","conf":"Verificado"},{"row":66,"app":"FossFLOW (BPM)","comp":"Pipefy","plan":"Business","precio":18,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Free hasta 10 usuarios y 5 procesos","fuente":"aiproductivity.ai/blog/cflow-vs-kissflow-vs-pipefy","conf":"Verificado"},{"row":67,"app":"FossFLOW (BPM)","comp":"Kissflow","plan":"Por usuario","precio":9.9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"checkthat.ai/brands/kissflow/pricing","conf":"Verificado"},{"row":68,"app":"FossFLOW (BPM)","comp":"Process Street","plan":"Startup","precio":100,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"process.st/pricing","conf":"Estimado"},{"row":69,"app":"FossFLOW (BPM)","comp":"monday.com","plan":"Basic","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Usado como plataforma de workflow","fuente":"moxo.com/blog/best-business-process-management-software","conf":"Verificado"},{"row":70,"app":"FossFLOW (BPM)","comp":"Kissflow","plan":"Basic (plataforma)","precio":2500,"unidad":"Plano","seg":"Enterprise","nota":"Subió desde USD 1.500 en 2025","fuente":"checkthat.ai/brands/kissflow/pricing","conf":"Verificado"},{"row":71,"app":"FossFLOW (BPM)","comp":"Nintex","plan":"Standard","precio":1405,"unidad":"Plano","seg":"Enterprise","nota":"","fuente":"spotsaas.com/compare/kissflow-vs-nintex","conf":"Verificado"},{"row":72,"app":"Digitai (automatización IA)","comp":"Dify","plan":"Professional","precio":59,"unidad":"Plano","seg":"PyME / Empresa","nota":"5.000 créditos de mensajes","fuente":"checkthat.ai/brands/dify/pricing","conf":"Verificado"},{"row":73,"app":"Digitai (automatización IA)","comp":"Dify","plan":"Team","precio":159,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 créditos","fuente":"checkthat.ai/brands/dify/pricing","conf":"Verificado"},{"row":74,"app":"Digitai (automatización IA)","comp":"Flowise","plan":"Starter","precio":35,"unidad":"Plano","seg":"PyME / Empresa","nota":"Open source, self-host gratis","fuente":"opentools.ai/tools/flowiseai","conf":"Verificado"},{"row":75,"app":"Digitai (automatización IA)","comp":"Flowise","plan":"Enterprise","precio":65,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"opentools.ai/tools/flowiseai","conf":"Verificado"},{"row":76,"app":"Digitai (automatización IA)","comp":"n8n","plan":"Starter","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"Self-host gratis","fuente":"lindy.ai/blog/n8n-pricing","conf":"Verificado"},{"row":77,"app":"Digitai (automatización IA)","comp":"Relevance AI","plan":"Team","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"relevanceai.com/pricing","conf":"Estimado"},{"row":78,"app":"Formularios de Contacto","comp":"Typeform","plan":"Basic","precio":29,"unidad":"Plano","seg":"PyME / Empresa","nota":"100 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":79,"app":"Formularios de Contacto","comp":"Typeform","plan":"Plus","precio":59,"unidad":"Plano","seg":"PyME / Empresa","nota":"1.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":80,"app":"Formularios de Contacto","comp":"Typeform","plan":"Business","precio":99,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":81,"app":"Formularios de Contacto","comp":"Jotform","plan":"Bronze","precio":24.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"1.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":82,"app":"Formularios de Contacto","comp":"Jotform","plan":"Gold","precio":129,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 respuestas/mes","fuente":"stackcoast.com/typeform-vs-jotform-vs-tally","conf":"Verificado"},{"row":83,"app":"Formularios de Contacto","comp":"Tally","plan":"Pro","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual; free con respuestas ilimitadas","fuente":"formmate.app/blog/typeform-vs-tally","conf":"Verificado"},{"row":84,"app":"Formularios de Contacto","comp":"Fillout","plan":"Pro","precio":40,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"customjs.space/blog/best-form-builders-automation-2026","conf":"Verificado"},{"row":85,"app":"Formularios de Contacto","comp":"Fillout","plan":"Business","precio":75,"unidad":"Plano","seg":"PyME / Empresa","nota":"Respuestas ilimitadas","fuente":"customjs.space/blog/best-form-builders-automation-2026","conf":"Verificado"},{"row":86,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Lite","precio":14,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":87,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Growth","precio":39,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":88,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Premium","precio":59,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":89,"app":"Prospección Comercial","comp":"Pipedrive","plan":"Ultimate","precio":79,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"pipedrive.com/en/pricing","conf":"Verificado"},{"row":90,"app":"Prospección Comercial","comp":"HubSpot Sales Hub","plan":"Starter","precio":15,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 20 con pago mensual","fuente":"docket.io/resources/research/hubspot-sales-hub-pricing","conf":"Verificado"},{"row":91,"app":"Prospección Comercial","comp":"HubSpot Sales Hub","plan":"Professional","precio":90,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Más USD 1.500 de onboarding","fuente":"docket.io/resources/research/hubspot-sales-hub-pricing","conf":"Verificado"},{"row":92,"app":"Prospección Comercial","comp":"Apollo.io","plan":"Basic","precio":49,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"salesmotion.io/blog/apollo-pricing","conf":"Verificado"},{"row":93,"app":"Prospección Comercial","comp":"Apollo.io","plan":"Organization","precio":119,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"salesmotion.io/blog/apollo-pricing","conf":"Verificado"},{"row":94,"app":"Prospección Comercial","comp":"Lusha","plan":"Starter","precio":37.45,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"cognism.com/blog/apollo-io-pricing","conf":"Verificado"},{"row":95,"app":"Prospección Comercial","comp":"Salesforce","plan":"Starter Suite","precio":25,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"salesforce.com/sales/pricing","conf":"Verificado"},{"row":96,"app":"Prospección Comercial","comp":"Salesforce","plan":"Pro Suite","precio":100,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"salesforce.com/sales/pricing","conf":"Verificado"},{"row":97,"app":"Prospección Comercial","comp":"Salesforce","plan":"Enterprise","precio":175,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Subió 6% en ago-2025","fuente":"salesforce.com/sales/pricing","conf":"Verificado"},{"row":98,"app":"Social Planner","comp":"Buffer","plan":"Essentials","precio":5,"unidad":"Por canal","seg":"PyME / Empresa","nota":"Pago anual","fuente":"buffer.com/pricing","conf":"Verificado"},{"row":99,"app":"Social Planner","comp":"Buffer","plan":"Team","precio":10,"unidad":"Por canal","seg":"PyME / Empresa","nota":"Pago anual","fuente":"buffer.com/pricing","conf":"Verificado"},{"row":100,"app":"Social Planner","comp":"Hootsuite","plan":"Standard","precio":99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"superdirector.app/compare/sprout-social-vs-hootsuite-vs-later","conf":"Verificado"},{"row":101,"app":"Social Planner","comp":"Hootsuite","plan":"Advanced","precio":249,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Rango 199-399","fuente":"superdirector.app/compare/sprout-social-vs-hootsuite-vs-later","conf":"Verificado"},{"row":102,"app":"Social Planner","comp":"Metricool","plan":"Starter","precio":18,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual; USD 22 mensual","fuente":"checkthat.ai/brands/metricool/pricing","conf":"Verificado"},{"row":103,"app":"Social Planner","comp":"Later","plan":"Starter","precio":18.75,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"later.com/blog/social-media-scheduling-tools","conf":"Verificado"},{"row":104,"app":"Social Planner","comp":"Sprout Social","plan":"Advanced","precio":249,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual","fuente":"planifyapps.com/compare/metricool-vs-sprout-social","conf":"Verificado"},{"row":105,"app":"Kreative Studio","comp":"Canva","plan":"Teams","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Pago anual, mínimo 3 asientos; USD 20 mensual","fuente":"canvapricing.com","conf":"Verificado"},{"row":106,"app":"Kreative Studio","comp":"Adobe Express","plan":"Teams","precio":7.99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"USD 4,99 el primer año","fuente":"insidepro360.com/en/saas-tools/canva-vs-adobe-express-vs-figma","conf":"Verificado"},{"row":107,"app":"Kreative Studio","comp":"Figma","plan":"Professional","precio":12,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Rango 12-60 según tipo de asiento","fuente":"match-vs.com/en/blog/best-design-tools","conf":"Verificado"},{"row":108,"app":"Kreative Studio","comp":"VistaCreate","plan":"Pro","precio":13,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"create.vista.com/pricing","conf":"Estimado"},{"row":109,"app":"Kimos FunPlai (gamificación)","comp":"Kahoot!","plan":"Paid","precio":29,"unidad":"Plano","seg":"PyME / Empresa","nota":"Desde USD 10; free hasta 25 asistentes","fuente":"saasworthy.com/product/kahoot/pricing","conf":"Verificado"},{"row":110,"app":"Kimos FunPlai (gamificación)","comp":"Spinify","plan":"Essentials","precio":9,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/155500/Spinify","conf":"Verificado"},{"row":111,"app":"Kimos FunPlai (gamificación)","comp":"Spinify","plan":"Plus","precio":40,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/155500/Spinify","conf":"Verificado"},{"row":112,"app":"Kimos FunPlai (gamificación)","comp":"TalentLMS","plan":"Core","precio":119,"unidad":"Plano","seg":"PyME / Empresa","nota":"Insignias, puntos y rankings","fuente":"coursebox.ai/blog/gamified-learning-platforms","conf":"Verificado"},{"row":113,"app":"Kimos FunPlai (gamificación)","comp":"Mentimeter","plan":"Pro","precio":24.99,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"mentimeter.com/plans","conf":"Estimado"},{"row":114,"app":"Kimos FunPlai (gamificación)","comp":"Gametize","plan":"Business","precio":50,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/186453/Gametize","conf":"Estimado"},{"row":115,"app":"ProductLab","comp":"Productboard","plan":"Essentials","precio":20,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Por maker","fuente":"blog.buildbetter.ai/best-ai-product-roadmap-tools","conf":"Verificado"},{"row":116,"app":"ProductLab","comp":"Productboard","plan":"Pro","precio":80,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Por maker","fuente":"blog.buildbetter.ai/best-ai-product-roadmap-tools","conf":"Verificado"},{"row":117,"app":"ProductLab","comp":"Aha!","plan":"Discovery","precio":39,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"productlift.dev/blog/aha-pricing","conf":"Verificado"},{"row":118,"app":"ProductLab","comp":"Aha!","plan":"Roadmaps","precio":59,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"productlift.dev/blog/aha-pricing","conf":"Verificado"},{"row":119,"app":"ProductLab","comp":"Airfocus","plan":"Essential","precio":19,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"ideaplan.io/alternatives/airfocus","conf":"Verificado"},{"row":120,"app":"ProductLab","comp":"Airfocus","plan":"Advanced","precio":69,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"","fuente":"ideaplan.io/alternatives/airfocus","conf":"Verificado"},{"row":121,"app":"ProductLab","comp":"Jira Product Discovery","plan":"Standard","precio":10,"unidad":"Por usuario","seg":"PyME / Empresa","nota":"Solo creadores facturan","fuente":"featurebase.app/blog/jira-product-discovery-pricing","conf":"Verificado"},{"row":122,"app":"Productos (PIM)","comp":"Plytix","plan":"Pro","precio":499,"unidad":"Plano","seg":"PyME / Empresa","nota":"50.000 SKU, asientos ilimitados","fuente":"plytix.com/pricing","conf":"Verificado"},{"row":123,"app":"Productos (PIM)","comp":"Plytix","plan":"Brand Portals add-on","precio":300,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"plytix.com/pricing","conf":"Verificado"},{"row":124,"app":"Productos (PIM)","comp":"Sales Layer","plan":"Business","precio":1000,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"saleslayer.com/pricing","conf":"Estimado"},{"row":125,"app":"Productos (PIM)","comp":"Akeneo","plan":"Growth SaaS","precio":3750,"unidad":"Plano","seg":"Enterprise","nota":"USD 45.000/ano","fuente":"piminto.com/blog/akeneo-pricing","conf":"Verificado"},{"row":126,"app":"Productos (PIM)","comp":"Salsify","plan":"Enterprise","precio":6250,"unidad":"Plano","seg":"Enterprise","nota":"USD 75.000/ano piso","fuente":"pimworks.io/blog/salsify-vs-akeneo","conf":"Verificado"},{"row":127,"app":"Tienda (e-commerce)","comp":"Shopify","plan":"Basic","precio":39,"unidad":"Plano","seg":"PyME / Empresa","nota":"Más comisiones de pago","fuente":"shopify.com/pricing","conf":"Verificado"},{"row":128,"app":"Tienda (e-commerce)","comp":"Shopify","plan":"Grow","precio":105,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"shopify.com/pricing","conf":"Verificado"},{"row":129,"app":"Tienda (e-commerce)","comp":"Shopify","plan":"Advanced","precio":399,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"shopify.com/pricing","conf":"Verificado"},{"row":130,"app":"Tienda (e-commerce)","comp":"BigCommerce","plan":"Standard","precio":39,"unidad":"Plano","seg":"PyME / Empresa","nota":"Tope por volumen de ventas anual","fuente":"getathenic.com/blog/best-ecommerce-platform-comparison-2026","conf":"Verificado"},{"row":131,"app":"Tienda (e-commerce)","comp":"BigCommerce","plan":"Plus","precio":105,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"getathenic.com/blog/best-ecommerce-platform-comparison-2026","conf":"Verificado"},{"row":132,"app":"Tienda (e-commerce)","comp":"Wix","plan":"Core","precio":17,"unidad":"Plano","seg":"PyME / Empresa","nota":"Pago anual","fuente":"websitebuilderexpert.com/ecommerce-website-builders/comparisons/wix-vs-shopify","conf":"Verificado"},{"row":133,"app":"Tienda (e-commerce)","comp":"Wix","plan":"Business Elite","precio":159,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"websitebuilderexpert.com/ecommerce-website-builders/comparisons/wix-vs-shopify","conf":"Verificado"},{"row":134,"app":"Vitrina (catálogo digital)","comp":"Linktree","plan":"Pro","precio":9,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"linktr.ee/pricing","conf":"Estimado"},{"row":135,"app":"Vitrina (catálogo digital)","comp":"Linktree","plan":"Premium","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"linktr.ee/pricing","conf":"Estimado"},{"row":136,"app":"Vitrina (catálogo digital)","comp":"Flipsnack","plan":"Starter","precio":14,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"flipsnack.com/pricing","conf":"Estimado"},{"row":137,"app":"Vitrina (catálogo digital)","comp":"Flipsnack","plan":"Professional","precio":35,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"flipsnack.com/pricing","conf":"Estimado"},{"row":138,"app":"Vitrina (catálogo digital)","comp":"Plytix","plan":"Brand Portals","precio":300,"unidad":"Plano","seg":"PyME / Empresa","nota":"Add-on sobre plan PIM","fuente":"plytix.com/pricing","conf":"Verificado"},{"row":139,"app":"KIMOS Cashflow","comp":"Float","plan":"Essential","precio":49,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/agicap-vs-moneto-vs-floatapp","conf":"Verificado"},{"row":140,"app":"KIMOS Cashflow","comp":"Float","plan":"Standard","precio":99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/agicap-vs-moneto-vs-floatapp","conf":"Verificado"},{"row":141,"app":"KIMOS Cashflow","comp":"Float","plan":"Premium","precio":199,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"spotsaas.com/compare/agicap-vs-moneto-vs-floatapp","conf":"Verificado"},{"row":142,"app":"KIMOS Cashflow","comp":"Fathom","plan":"Starter","precio":50,"unidad":"Plano","seg":"PyME / Empresa","nota":"Por módulo","fuente":"capterra.com/p/136476/Fathom","conf":"Verificado"},{"row":143,"app":"KIMOS Cashflow","comp":"Fathom","plan":"Silver","precio":260,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"capterra.com/p/136476/Fathom","conf":"Verificado"},{"row":144,"app":"KIMOS Cashflow","comp":"Agicap","plan":"Business","precio":180,"unidad":"Plano","seg":"PyME / Empresa","nota":"Precio bajo cotización, no publicado","fuente":"g2.com/products/agicap/pricing","conf":"Estimado"},{"row":145,"app":"Gestión de Eventos","comp":"Luma","plan":"Plus","precio":59,"unidad":"Plano","seg":"PyME / Empresa","nota":"0% comisión; free con 5%","fuente":"spotsaas.com/compare/luma-vs-eventbrite","conf":"Verificado"},{"row":146,"app":"Gestión de Eventos","comp":"Eventbrite","plan":"Pro","precio":15,"unidad":"Plano","seg":"PyME / Empresa","nota":"Más 3,7% + USD 1,79 por ticket","fuente":"stackscored.com/pricing/event-management","conf":"Verificado"},{"row":147,"app":"Gestión de Eventos","comp":"Dryfta","plan":"Basic","precio":99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"dryfta.com/pricing","conf":"Estimado"},{"row":148,"app":"Gestión de Eventos","comp":"Bizzabo","plan":"Event Experience OS","precio":499,"unidad":"Por usuario","seg":"Enterprise","nota":"Mínimo 3 usuarios = USD 17.999/ano","fuente":"stackscored.com/pricing/event-management","conf":"Verificado"},{"row":149,"app":"Gestión de Eventos","comp":"Cvent","plan":"Enterprise","precio":4167,"unidad":"Plano","seg":"Enterprise","nota":"USD 50.000/ano piso estimado","fuente":"stackscored.com/pricing/event-management","conf":"Estimado"},{"row":150,"app":"Integraciones","comp":"Zapier","plan":"Professional","precio":19.99,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":151,"app":"Integraciones","comp":"Zapier","plan":"Team","precio":69,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"lindy.ai/blog/zapier-pricing","conf":"Verificado"},{"row":152,"app":"Integraciones","comp":"Make","plan":"Core","precio":9,"unidad":"Plano","seg":"PyME / Empresa","nota":"10.000 operaciones","fuente":"automationatlas.io/guides/zapier-vs-make-n8n-comparison","conf":"Verificado"},{"row":153,"app":"Integraciones","comp":"n8n","plan":"Starter","precio":24,"unidad":"Plano","seg":"PyME / Empresa","nota":"","fuente":"lindy.ai/blog/n8n-pricing","conf":"Verificado"}],"planes":[{"id":"core","nombre":"Core","para":"Empresas que entran a probar la suite","incluye":"Plataforma base: escritorio con agentes, archivos, notas, equipos, conocimiento e integraciones","mods":[1,4,9,6,5,24],"desc":0.55},{"id":"starter","nombre":"Starter","para":"PyMEs de 5 a 20 personas sin procesos formales","incluye":"Core + gestión de tareas + captura de leads","mods":[1,4,9,6,5,24,7,13],"desc":0.55},{"id":"business","nombre":"Business","para":"Empresas de 20 a 100 personas con equipo comercial","incluye":"Core + proyectos + CRM + marketing + dashboards + agentes IA","mods":[1,4,9,6,5,24,7,13,8,14,15,16,10,2],"desc":0.6},{"id":"enterprise","nombre":"Enterprise","para":"Empresas de 100+ personas o con procesos regulados","incluye":"Todos los módulos, incluidos BPM, PIM, Tienda, Cashflow, ProductLab, Eventos y Agentes Web","mods":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],"desc":0.62}],"kits":[{"id":"comercial","nombre":"Kit Comercial","para":"Equipos de ventas y marketing","incluye":"Captar, atender y cerrar: CRM + formularios + chatbot + redes + diseño","mods":[14,13,3,15,16],"desc":0.45},{"id":"operaciones","nombre":"Kit Operaciones","para":"PMOs, operaciones y consultoras","incluye":"Ejecutar y controlar: tareas + Gantt + procesos + paneles","mods":[7,8,11,10,9],"desc":0.45},{"id":"retail","nombre":"Kit Retail","para":"Retail, distribución y marcas","incluye":"Vender en línea: catálogo maestro + tienda + vitrina + bot + diseño","mods":[19,20,21,3,16],"desc":0.45},{"id":"ia","nombre":"Kit IA","para":"Equipos técnicos y de innovación","incluye":"Automatizar con IA: escritorio + agentes + pipelines de datos + bot + base de conocimiento","mods":[1,2,12,3,5],"desc":0.45},{"id":"finanzas","nombre":"Kit Finanzas y Gestión","para":"Gerencia financiera","incluye":"Controlar la plata: flujo de caja + paneles + planificación + documentos","mods":[22,10,8,4],"desc":0.45}],"stack":[{"necesidad":"Archivos, correo y videollamadas","herramienta":"Google Workspace","plan":"Business Standard","comp":21},{"necesidad":"Chat de equipo","herramienta":"Slack","plan":"Pro","comp":32},{"necesidad":"Tareas y proyectos","herramienta":"ClickUp","plan":"Business","comp":41},{"necesidad":"Planificación Gantt","herramienta":"Smartsheet","plan":"Pro","comp":46},{"necesidad":"Base de conocimiento","herramienta":"Confluence","plan":"Standard","comp":27},{"necesidad":"Notas colaborativas","herramienta":"Notion","plan":"Plus","comp":54},{"necesidad":"CRM y prospección","herramienta":"Pipedrive","plan":"Growth","comp":87},{"necesidad":"Redes sociales","herramienta":"Buffer","plan":"Team","comp":99},{"necesidad":"Formularios","herramienta":"Typeform","plan":"Basic","comp":78},{"necesidad":"Diseño gráfico","herramienta":"Canva","plan":"Teams","comp":105},{"necesidad":"Chatbot web","herramienta":"Tidio","plan":"Growth","comp":12},{"necesidad":"Flujo de caja","herramienta":"Float","plan":"Standard","comp":140},{"necesidad":"Dashboards","herramienta":"Power BI","plan":"Pro","comp":61},{"necesidad":"Automatización de procesos","herramienta":"Pipefy","plan":"Business","comp":66},{"necesidad":"Automatización IA","herramienta":"Dify","plan":"Professional","comp":72},{"necesidad":"Gamificación","herramienta":"Kahoot!","plan":"Paid","comp":109},{"necesidad":"Gestión de producto","herramienta":"Jira Product Discovery","plan":"Standard","comp":121},{"necesidad":"PIM / catálogo","herramienta":"Plytix","plan":"Pro","comp":122},{"necesidad":"Tienda online","herramienta":"Shopify","plan":"Grow","comp":128},{"necesidad":"Vitrina de marca","herramienta":"Linktree","plan":"Premium","comp":135},{"necesidad":"Asistente IA","herramienta":"ChatGPT Business","plan":"Business","comp":0},{"necesidad":"Agentes / automatización","herramienta":"Zapier","plan":"Team","comp":6},{"necesidad":"Integraciones","herramienta":"Make","plan":"Core","comp":152},{"necesidad":"Eventos","herramienta":"Luma","plan":"Plus","comp":145}],"demanda":{"params":{"saasGlobal":{"label":"Mercado SaaS global 2026","valor":375570,"unidad":"USD MM","nota":"Suma de las cinco regiones"},"gastoSuites":{"label":"Gasto en suites de gestión","valor":0.22,"unidad":"% del SaaS","nota":"Supuesto: participación de suites de gestión y productividad"},"pymeShare":{"label":"Participación PyME y mid-market","valor":0.45,"unidad":"% de la categoría","nota":"Supuesto"},"segmento":{"label":"Segmento 10-250 empleados","valor":0.55,"unidad":"% del segmento","nota":"Supuesto: rango que KIMOS puede atender"},"churn":{"label":"Churn mensual","valor":0.04,"unidad":"%","nota":"Benchmark PyME: 3% a 7%, mediana 3,5%"},"margen":{"label":"Margen bruto","valor":0.75,"unidad":"%","nota":"Castigado por el costo variable de IA"},"cac":{"label":"CAC promedio","valor":1200,"unidad":"USD","nota":"Benchmark PyME autoservicio: USD 200 a 700"},"clientes3":{"label":"Clientes captados al año 3","valor":550,"unidad":"clientes","nota":"Bruto acumulado, antes de churn"}},"regiones":[{"region":"Norteamérica","saas":172680,"share":0.46,"cagr":0.13,"cobertura":0.15,"indice":1,"lectura":"EE.UU. y Canadá. Mayor concentración de proveedores e infraestructura cloud madura. También donde están todos los competidores con capital ilimitado.","fuente":"fortunebusinessinsights.com/software-as-a-service-saas-market-102222","conf":"Verificado"},{"region":"Asia-Pacífico","saas":86060,"share":0.229,"cagr":0.22,"cobertura":0.1,"indice":0.7,"lectura":"Región de mayor crecimiento del mundo. Mayor varianza interna de precio: 40 puntos entre Japon/Australia y el sudeste asiático emergente.","fuente":"precedenceresearch.com/software-as-a-service-market","conf":"Verificado"},{"region":"Europa","saas":70810,"share":0.189,"cagr":0.12,"cobertura":0.2,"indice":0.95,"lectura":"Mercado maduro con alta exigencia de cumplimiento (GDPR, residencia de datos). Los nórdicos pagan 8-18% de premium sobre el baseline de EE.UU.","fuente":"fortunebusinessinsights.com/software-as-a-service-saas-market-102222","conf":"Verificado"},{"region":"América Latina","saas":21000,"share":0.056,"cagr":0.148,"cobertura":0.6,"indice":0.6,"lectura":"USD 21.000 MM en 2025, proyectado a USD 45.000 MM en 2030. Brasil concentra el 60% de las ~17.000 empresas SaaS de la región.","fuente":"informesdeexpertos.com/informes/mercado-latinoamericano-de-software-como-servicio-saas","conf":"Verificado"},{"region":"Medio Oriente y África","saas":25020,"share":0.066,"cagr":0.16,"cobertura":0.05,"indice":0.55,"lectura":"Residual del total global. Mercado incipiente, alta dependencia de proveedores globales.","fuente":"Calculo residual sobre el total global de USD 375.570 MM","conf":"Estimado"}],"paises":[{"pais":"Estados Unidos","region":"Norteamérica","idioma":"Inglés","prioridad":"Expansión","cobertura":0.2,"peso":0.7935,"publicado":141060,"indice":1,"empresas":36200000,"contexto":"USD 141.060 MM en 2026, el 37,5% del mercado mundial. 36,2 millones de pequeñas empresas, el 99,9% del total.","conf":"Verificado"},{"pais":"Canadá","region":"Norteamérica","idioma":"Inglés","prioridad":"Expansión","cobertura":0.2,"peso":0.2065,"publicado":36700,"indice":0.95,"empresas":null,"contexto":"USD 36.700 MM: el 16% del gasto SaaS norteamericano. Crece al 12,6% anual hasta 2030.","conf":"Verificado"},{"pais":"Alemania","region":"Europa","idioma":"Alemán","prioridad":"Oportunista","cobertura":0.08,"peso":0.2092,"publicado":14810,"indice":0.98,"empresas":3200000,"contexto":"El mayor mercado SaaS de Europa. 3,2 millones de empresas activas.","conf":"Verificado"},{"pais":"Francia","region":"Europa","idioma":"Francés","prioridad":"Oportunista","cobertura":0.08,"peso":0.1863,"publicado":13190,"indice":0.95,"empresas":5300000,"contexto":"5,3 millones de empresas activas, la mayor población empresarial de la UE.","conf":"Verificado"},{"pais":"Reino Unido","region":"Europa","idioma":"Inglés","prioridad":"Expansión","cobertura":0.2,"peso":0.1826,"publicado":12930,"indice":0.98,"empresas":null,"contexto":"Puerta de entrada natural a Europa por idioma y práctica comercial.","conf":"Verificado"},{"pais":"Italia","region":"Europa","idioma":"Italiano","prioridad":"Oportunista","cobertura":0.08,"peso":0.0833,"publicado":null,"indice":0.85,"empresas":4600000,"contexto":"4,6 millones de empresas activas. Mercado cloud de USD 14.300 MM en 2025 creciendo al 16,4%.","conf":"Estimado"},{"pais":"España","region":"Europa","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0621,"publicado":null,"indice":0.82,"empresas":3500000,"contexto":"3,5 millones de empresas activas. Mismo idioma: es el puente entre LATAM y Europa.","conf":"Estimado"},{"pais":"Nórdicos","region":"Europa","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.065,"publicado":null,"indice":1.05,"empresas":null,"contexto":"Suecia, Dinamarca, Noruega y Finlandia. Pagan entre 8% y 18% de premium sobre la lista de EE.UU.","conf":"Estimado"},{"pais":"Países Bajos","region":"Europa","idioma":"Neerlandés","prioridad":"Oportunista","cobertura":0.08,"peso":0.0466,"publicado":null,"indice":0.98,"empresas":null,"contexto":"Alta digitalización y operación comercial en inglés.","conf":"Estimado"},{"pais":"Polonia","region":"Europa","idioma":"Polaco","prioridad":"No perseguir","cobertura":0.01,"peso":0.0311,"publicado":null,"indice":0.62,"empresas":null,"contexto":"Crece rápido pero con menor poder adquisitivo y competencia local fuerte.","conf":"Estimado"},{"pais":"Resto de Europa","region":"Europa","idioma":"Varios","prioridad":"No perseguir","cobertura":0.01,"peso":0.1338,"publicado":null,"indice":0.75,"empresas":null,"contexto":"Agregado del resto del continente. Total de PyMEs en la UE: 34 millones.","conf":"Derivado"},{"pais":"China","region":"Asia-Pacífico","idioma":"Chino","prioridad":"No perseguir","cobertura":0.01,"peso":0.2259,"publicado":19440,"indice":0.55,"empresas":null,"contexto":"El mayor mercado de la región. Ecosistema cerrado y competencia local dominante.","conf":"Verificado"},{"pais":"India","region":"Asia-Pacífico","idioma":"Inglés","prioridad":"No perseguir","cobertura":0.01,"peso":0.2004,"publicado":17250,"indice":0.35,"empresas":null,"contexto":"Proyectado a USD 58.400 MM en 2033 creciendo al 16,9% anual: el de mayor crecimiento del mundo, y también el más sensible al precio.","conf":"Verificado"},{"pais":"Japón","region":"Asia-Pacífico","idioma":"Japonés","prioridad":"No perseguir","cobertura":0.01,"peso":0.1981,"publicado":17050,"indice":0.85,"empresas":3500000,"contexto":"3,5 millones de MiPymes, el 99,7% de las empresas. Exige localización profunda y ciclos largos.","conf":"Verificado"},{"pais":"Australia","region":"Asia-Pacífico","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.1604,"publicado":13800,"indice":0.98,"empresas":null,"contexto":"USD 13.800 MM estimados para 2026. El 2,6% del mercado mundial y el mercado más accesible de la región por idioma.","conf":"Verificado"},{"pais":"Corea del Sur","region":"Asia-Pacífico","idioma":"Coreano","prioridad":"No perseguir","cobertura":0.01,"peso":0.0755,"publicado":null,"indice":0.8,"empresas":null,"contexto":"Crece al 9,4% anual. Alta digitalización pero fuerte preferencia por proveedores locales.","conf":"Estimado"},{"pais":"Singapur","region":"Asia-Pacífico","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.0349,"publicado":null,"indice":0.95,"empresas":null,"contexto":"Pequeño pero de alto ticket y en inglés. Buena cabecera de playa regional.","conf":"Estimado"},{"pais":"Resto de Asia-Pacífico","region":"Asia-Pacífico","idioma":"Varios","prioridad":"No perseguir","cobertura":0.01,"peso":0.1048,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Sudeste asiático emergente. Hasta 40 puntos de precio por debajo de Japón y Australia.","conf":"Derivado"},{"pais":"Brasil","region":"América Latina","idioma":"Portugués","prioridad":"Expansión","cobertura":0.2,"peso":0.5513,"publicado":11578,"indice":0.55,"empresas":null,"contexto":"USD 9.216 MM en 2024 creciendo al 12,1% anual. Concentra el 60% de las ~17.000 empresas SaaS de la región.","conf":"Verificado"},{"pais":"México","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.17,"publicado":3570,"indice":0.6,"empresas":6000000,"contexto":"El 17% del mercado SaaS latinoamericano. 6 millones de unidades económicas; las pymes dan 7 de cada 10 empleos.","conf":"Verificado"},{"pais":"Argentina","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0619,"publicado":null,"indice":0.45,"empresas":null,"contexto":"Las pymes son el 99,4% de las empresas y emplean al 64% de los asalariados. El 41,6% ya usa alguna herramienta de IA.","conf":"Estimado"},{"pais":"Colombia","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0548,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Uno de los países más emprendedores de la región junto con México y Perú.","conf":"Estimado"},{"pais":"Chile","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0548,"publicado":null,"indice":0.62,"empresas":1194430,"contexto":"Mercado base de KIMOS. 1,19 millones de MiPymes formales y el mayor poder adquisitivo de la región.","conf":"Estimado"},{"pais":"Perú","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0286,"publicado":null,"indice":0.5,"empresas":2100000,"contexto":"Más de 2,1 millones de MiPymes formales.","conf":"Estimado"},{"pais":"Resto de América Latina","region":"América Latina","idioma":"Español","prioridad":"Prioritario","cobertura":0.6,"peso":0.0786,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Centroamérica, Caribe hispano, Ecuador, Uruguay, Bolivia y Paraguay.","conf":"Derivado"},{"pais":"Arabia Saudita","region":"Medio Oriente y África","idioma":"Árabe","prioridad":"No perseguir","cobertura":0.01,"peso":0.18,"publicado":null,"indice":0.85,"empresas":null,"contexto":"Fuerte inversión estatal en digitalización.","conf":"Estimado"},{"pais":"Emiratos Árabes Unidos","region":"Medio Oriente y África","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.16,"publicado":null,"indice":0.9,"empresas":null,"contexto":"Hub regional, alto poder adquisitivo y operación en inglés.","conf":"Estimado"},{"pais":"Israel","region":"Medio Oriente y África","idioma":"Inglés","prioridad":"Oportunista","cobertura":0.08,"peso":0.12,"publicado":null,"indice":0.95,"empresas":null,"contexto":"Alta densidad tecnológica y también altísima competencia local.","conf":"Estimado"},{"pais":"Sudáfrica","region":"Medio Oriente y África","idioma":"Inglés","prioridad":"No perseguir","cobertura":0.01,"peso":0.1,"publicado":null,"indice":0.5,"empresas":null,"contexto":"Principal mercado del África subsahariana.","conf":"Estimado"},{"pais":"Resto de Medio Oriente y África","region":"Medio Oriente y África","idioma":"Varios","prioridad":"No perseguir","cobertura":0.01,"peso":0.44,"publicado":null,"indice":0.4,"empresas":null,"contexto":"Agregado del resto de la región.","conf":"Derivado"}],"mixPlan":[{"plan":"Starter","peso":0.6},{"plan":"Business","peso":0.3},{"plan":"Enterprise","peso":0.1}],"mixRegion":[{"region":"América Latina","peso":0.55},{"region":"Europa","peso":0.18},{"region":"Norteamérica","peso":0.15},{"region":"Asia-Pacífico","peso":0.1},{"region":"Medio Oriente y África","peso":0.02}]},"evidencia":[{"titulo":"Universo de empresas","cols":["Ámbito","Métrica","Valor","Unidad","Contexto","Fuente","Confianza"],"filas":[["Global","Pequeñas empresas en el mundo","400.000.000","empresas","El 90% de las empresas operativas del mundo son PyMEs y emplean a más del 50% de la fuerza laboral global","hostinger.com/tutorials/small-business-statistics","Verificado"],["Estados Unidos","Pequeñas empresas","36.200.000","empresas","Representan el 99,9% de todas las compañías del país","demandsage.com/small-business-statistics","Verificado"],["Union Europea","PyMEs","24.000.000","empresas","Representan el 99,8% del tejido empresarial europeo. Cifra exacta tras muro de pago; orden de magnitud confirmado","europarl.europa.eu/factsheets/en/sheet/63/small-and-medium-sized-enterprises","Estimado"],["Norteamérica","Adopción de software PyME","40","% del global","Lidera la adopción mundial de software PyME por madurez de infraestructura","businessresearchinsights.com/market-reports/small-and-medium-business-smb-software-market-108773","Verificado"],["Chile","MiPymes formales","1.194.430","empresas","66% micro, 29% pequeñas, 5% medianas. Emplean a 6,4 millones de personas (~50% del empleo)","sii.cl/estadisticas/empresas_tamano_ventas.htm","Verificado"],["México","Unidades económicas","6.000.000","empresas","Las pymes generan 7 de cada 10 puestos de trabajo del país","konfio.mx/blog/panorama-pyme/datos-clave-del-crecimiento-empresarial-en-mexico","Verificado"],["Perú","MiPymes formales","2.100.000","empresas","Dato 2021, último consolidado disponible","ogeiee.produce.gob.pe/index.php/en/shortcode/estadistica-oee/estadisticas-mipyme","Verificado"],["Argentina","PyMEs sobre el total","99.4","% de empresas","Emplean al 64% de los asalariados registrados","infopymes.com.ar/pymes-como-esta-la-argentina-en-comparacion-con-latam","Verificado"]]},{"titulo":"Consumo de SaaS","cols":["Métrica","Valor","Unidad","Por que importa","Fuente","Confianza"],"filas":[["Apps SaaS por empresa (promedio)","106","apps","Bajo un 18% desde el pico de 130 en 2022. La consolidación ya empezó.","zylo.com/blog/saas-statistics","Verificado"],["Apps SaaS en empresa pequeña","87","apps","Es el número que KIMOS promete reducir","zylo.com/blog/saas-statistics","Verificado"],["Apps SaaS en mid-market","187","apps","Segmento con mayor dolor de fragmentación","zylo.com/blog/saas-statistics","Verificado"],["Apps SaaS en gran empresa","371","apps","5.000+ empleados","zylo.com/blog/saas-statistics","Verificado"],["Gasto SaaS por empleado/ano","10.800","USD","Proyección 2026. En empresas pequeñas el rango va de USD 8.000 a 15.000.","vendorbenchmark.com/blog/saas-spend-per-employee-benchmark-data","Verificado"],["Crecimiento del gasto SaaS","8","% interanual","El portafolio de apps se mantiene estable pero el gasto sube por precios e IA embebida","zylo.com/blog/saas-statistics","Verificado"],["Líderes tech que planean consolidar","68","%","La mayoría apunta a reducir un 20% el número de proveedores durante 2026. Es exactamente la tesis de KIMOS.","vantagepoint.io/blog/sf/insights/platform-consolidation-2026-saas-stack-reduction-ai","Verificado"]]},{"titulo":"Comportamiento de compra","cols":["Que mide","Dato","Que significa para KIMOS","Fuente","Confianza"],"filas":[["Tamaño del comité de compra PyME","3 a 5 personas","1-2 campeones, 1-2 decisores, 2-5 influenciadores y 1-3 bloqueadores. En 2014 eran 5,4 en promedio; hoy el promedio general supera los 11.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"],["Ciclo de venta bajo USD 15K","14 a 30 días","Entre USD 15K y 50K sube a 30-60 días. Cada participante adicional en el comité suma 8-22 días.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"],["Proceso completado sin hablar con ventas","69%","El comprador investiga, compara y decide solo. Si KIMOS no pública precios, queda fuera antes de la primera reunión.","martal.ca/b2b-buying-process-lb","Verificado"],["Compradores que llegan con requisitos definidos","83%","No vienen a que les expliquen la categoría: vienen a validar si cumples una lista.","martal.ca/b2b-buying-process-lb","Verificado"],["Procurement como decisor","53% de los ciclos","Participa desde el inicio, no al final. En deals PyME esto suele ser el dueño o el gerente de administración.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"],["Probabilidad de estancamiento por stakeholder","12 a 22% adicional","Argumento fuerte para vender kits departamentales en vez de la suite completa: menos firmas, menos riesgo de que el deal muera.","growthspreeofficial.com/blogs/b2b-saas-buying-committee-size-benchmarks-2026","Verificado"]]},{"titulo":"Benchmarks de retención y adquisición","cols":["Métrica","Benchmark","Lectura","Fuente","Confianza"],"filas":[["Churn mensual PyME","3% a 7%","Mediana de 3,5% sobre 500+ empresas. El cuartil superior baja de 3%.","artisangrowthstrategies.com/blog/saas-churn-rate-benchmarks-2026-500-companies","Verificado"],["Churn en los primeros 90 días","40% a 60%","Del churn total. El negocio se gana en el onboarding, no en la venta.","saasfractionalcpo.com/blog/reduce-churn-in-saas-a-complete-guide","Verificado"],["Efecto de un onboarding estructurado","+25% de retención","En el primer año. Es la palanca de retención más barata que existe.","saasfractionalcpo.com/blog/reduce-churn-in-saas-a-complete-guide","Verificado"],["LTV:CAC en PyME","2,5:1","Funciona porque el costo de adquisición es bajo en términos absolutos, no porque el churn sea bueno.","optif.ai/learn/questions/b2b-saas-ltv-benchmark","Verificado"],["CAC en PyME","USD 200 a 700","Para venta autoservicio o inside sales ligera.","unbuiltlab.com/learn/benchmarks/saas-cac-benchmarks","Verificado"],["LTV en PyME","USD 15.000 a 40.000","Rango amplio según expansión de cuenta.","optif.ai/learn/questions/b2b-saas-ltv-benchmark","Verificado"],["Conversión free a pago","2% a 5%","Define cuanto tráfico hace falta para sostener el plan comercial.","foundrycro.com/blog/saas-marketing-benchmarks-2026","Verificado"],["CAC payback en PyME","6,2 meses","Herramientas PyME y prosumer. El objetivo general del sector es bajar de 12 meses.","foundrycro.com/blog/saas-marketing-benchmarks-2026","Verificado"]]},{"titulo":"Índice de precio por región","cols":["Región","Índice sobre EE.UU.","Nota","Fuente","Confianza"],"filas":[["Norteamérica","1","Línea base. KIMOS con factor 0,55 está dejando margen sobre la mesa en este mercado.","saasceo.com/localized-pricing","Verificado"],["Europa","0.95","Los nórdicos pagan 8-18% de premium sobre lista pero negocian 20-38% de descuento; el neto queda cerca del baseline.","vendorbenchmark.com/blog/software-pricing-regional-benchmark-global","Verificado"],["Asia-Pacífico","0.7","Promedio regional. Japón y Australia cerca del baseline; sudeste asiático hasta 40 puntos por debajo.","vendorbenchmark.com/blog/software-pricing-regional-benchmark-global","Verificado"],["América Latina","0.6","Los benchmarks locales están 40-60% bajo EE.UU. El 67% de los compradores prefiere igual el precio en USD.","saasceo.com/localized-pricing","Verificado"],["Medio Oriente y África","0.55","Menor poder adquisitivo y mayor fricción de pago.","geotargetly.com/blog/pricing-localization-saas","Estimado"]]}],"icp":[{"perfil":"El dueño que perdió el control del gasto","rol":"Gerente General o socio fundador","tamano":"10 a 50 empleados","producto":"Starter o Business","dolor":"Tiene entre 8 y 12 suscripciones sueltas y nadie sabe cuánto suman. La información vive en cuatro herramientas que no se hablan.","gatillo":"Le llega la renovación anual de una suscripción cara, o un error de coordinación le costó un cliente.","objecion":"\"Ya pague por estas herramientas y mi equipo las sabe usar. Cambiar me va a costar más de lo que ahorro.\"","venta":"Con la cuenta del stack actual sobre la mesa. No se vende funcionalidad: se vende la factura consolidada y las horas que se pierden saltando entre pestañas."},{"perfil":"El comercial sin pipeline visible","rol":"Gerente Comercial o de Ventas","tamano":"20 a 100 empleados","producto":"Kit Comercial","dolor":"Los leads del formulario web se pierden antes de llegar al vendedor. No hay forma de saber qué pasó con cada oportunidad.","gatillo":"Cierre de trimestre bajo meta, o la contratación de vendedores nuevos que necesitan un proceso.","objecion":"\"Mi CRM actual funciona y migrar el historial de clientes me da pánico.\"","venta":"Mostrando el ciclo cerrado: formulario, chatbot, CRM y campaña en el mismo lugar. El argumento es la fuga de leads, no el precio del CRM."},{"perfil":"El jefe de operaciones que vive en planillas","rol":"Jefe de Operaciones o PMO","tamano":"30 a 150 empleados","producto":"Kit Operaciones o BPM","dolor":"Los procesos críticos están en Excel sin trazabilidad ni control de versiones. Cada auditoría es una crisis.","gatillo":"Una certificación, una auditoría fallida, o un crecimiento que rompió la planilla.","objecion":"\"Esto lo tiene que aprobar TI y ellos ya tienen su propio roadmap.\"","venta":"Con trazabilidad y cumplimiento. Aquí el competidor es Kissflow a USD 2.500/mes de plataforma: la brecha de precio hace la venta sola."},{"perfil":"El de e-commerce con el catálogo roto","rol":"Gerente de E-commerce o Retail","tamano":"500+ SKU, 20 a 200 empleados","producto":"Kit Retail","dolor":"El catálogo vive en tres lugares distintos y publicar en un canal nuevo toma semanas de trabajo manual.","gatillo":"Apertura de un marketplace nuevo, rebranding, o una temporada alta que expuso el desorden.","objecion":"\"Ya tengo Shopify y no pienso migrar mi tienda.\"","venta":"No pidiéndole que migre. KIMOS es el catálogo maestro que alimenta a Shopify: integración, no reemplazo."},{"perfil":"El financiero que proyecta a ciegas","rol":"Gerente de Administración y Finanzas","tamano":"20 a 100 empleados","producto":"Kit Finanzas y Gestión","dolor":"Proyecta la caja en una planilla que solo él entiende y se entera de los problemas cuando ya ocurrieron.","gatillo":"Un apretón de caja, la solicitud de una línea de crédito o la entrada de un inversionista.","objecion":"\"Mi contador ya me entrega reportes y esto suena a duplicar trabajo.\"","venta":"Con la diferencia entre mirar hacia atrás y proyectar hacia adelante. Requiere integración bancaria local: sin eso, no compra."},{"perfil":"El de TI con mandato de IA y sin equipo","rol":"CTO, Jefe de TI o de Innovación","tamano":"50 a 250 empleados","producto":"Kit IA o Enterprise","dolor":"Mantiene 15 integraciones frágiles y tiene presión del directorio por \"hacer algo con IA\" sin presupuesto para contratar.","gatillo":"Mandato del directorio sobre IA, o una integración que se cayó y paro la operación.","objecion":"\"Puedo armar esto con n8n autohospedado y me sale gratis.\"","venta":"Con costo total de propiedad: el software open source es gratis, mantenerlo no. Es el perfil más escéptico y el que más valida antes de comprar."}],"segmentos":[{"segmento":"Micro","empleados":"1 a 9","veredicto":"No perseguir","plan":"-","porque":"No sostienen un ticket de suscripción integral y su tasa de mortalidad empresarial es alta.","riesgo":"Churn destructivo: cancelan cuando su propio ingreso se contrae. Consumen soporte y no dejan margen."},{"segmento":"Pequeña","empleados":"10 a 49","veredicto":"Objetivo primario","plan":"Starter y Kits","porque":"Ya sienten el dolor de la fragmentación pero deciden rápido: comité de 3 personas y ciclo de 14 a 30 días.","riesgo":"Sensibles al precio y con bajo costo de cambio. Se retienen con onboarding, no con contrato."},{"segmento":"Mediana","empleados":"50 a 249","veredicto":"Objetivo de mayor valor","plan":"Business y Enterprise","porque":"Es donde vive el dolor de las 187 apps y donde el presupuesto de consolidación es real.","riesgo":"Ciclo más largo, exige integraciones y suele tener TI con opinión propia."},{"segmento":"Grande","empleados":"250+","veredicto":"Nicho selectivo","plan":"Enterprise + implementación","porque":"Ticket alto y contratos plurianuales, pero exige SSO, auditoría, SLA y cumplimiento.","riesgo":"Puede consumir todo el roadmap atendiendo a un solo cliente. Aceptar solo con implementación pagada."}],"decisiones":[{"n":1,"decision":"La tesis de consolidación tiene viento a favor, y es medible","oferta":"La suite completa cuesta 28% de lo que gasta hoy el cliente en herramientas sueltas: USD 777 contra USD 2.767 al mes.","demanda":"El 68% de los líderes tecnológicos planea reducir proveedores en 2026 y el promedio de apps por empresa ya cayó de 130 a 106.","hacer":"Poner el ahorro consolidado al centro del discurso comercial, con la calculadora del stack actual como primera pantalla del sitio.","impacto":"alto"},{"n":2,"decision":"Una lista de precios única está regalando margen","oferta":"El factor de posicionamiento 0,55 deja a KIMOS 45% bajo la mediana del mercado, que se calculó sobre precios de lista estadounidenses.","demanda":"La disposición a pagar en LATAM está 40-60% bajo EE.UU., pero en Norteamérica y Europa el índice es 1,00 y 0,95.","hacer":"Mantener 0,55 en LATAM y subir a 0,85-0,90 en Norteamérica y Europa. Es la misma lista con tres precios, no tres productos.","impacto":"alto"},{"n":3,"decision":"Los kits no son una simplificación comercial: son una decisión de conversión","oferta":"El Enterprise sale USD 777 al mes; los kits, entre USD 204 y 263.","demanda":"Cada participante adicional en el comité suma entre 12% y 22% de probabilidad de que el deal se estanque, y los deals bajo USD 15K cierran en 14-30 días.","hacer":"Hacer del kit la oferta de entrada por defecto y dejar el Enterprise para expansión, no para adquisición.","impacto":"alto"},{"n":4,"decision":"El riesgo no está en el precio: está en los primeros 90 días","oferta":"24 módulos significan una superficie de producto enorme y un tiempo hasta el primer valor mucho más largo que el de una herramienta única.","demanda":"Entre el 40% y el 60% del churn ocurre antes del tercer mes, y un onboarding estructurado sube la retención del primer año un 25%.","hacer":"Onboarding pagado y obligatorio en PIM, BPM y Cashflow, y activación guiada a un solo módulo en los planes de entrada.","impacto":"alto"},{"n":5,"decision":"Publicar precios no es transparencia: es un requisito de entrada","oferta":"Pipedrive, Shopify, Notion y Plytix publican todo. Los que no publican juegan en enterprise con equipo de ventas propio.","demanda":"El 69% del proceso de compra ocurre sin contacto comercial y el 83% de los compradores llega con requisitos ya definidos.","hacer":"Publicar lista completa por región y una comparativa propia contra el stack típico. Sin eso KIMOS no entra a la lista corta.","impacto":"alto"},{"n":6,"decision":"Vender IA como promesa produce cancelaciones","oferta":"El Escritorio y los Agentes son el diferenciador más fuerte de la suite y el único que ningún competidor replica dentro de un mismo login.","demanda":"El 42% de las PyMEs ya empezó a implementar IA, pero solo el 23% captura valor económico medible y 6 de cada 10 no capturan nada.","hacer":"Instrumentar y mostrar el ahorro de horas por agente dentro del producto. La IA se cobra por resultado medido, no por acceso.","impacto":"alto"},{"n":7,"decision":"Hay módulos que sostienen la suite y módulos que solo la engordan","oferta":"PIM, CRM, BPM y Dashboards concentran el precio sugerido; Vitrina, Integraciones y Formularios aportan casi nada al ticket.","demanda":"El dolor de fragmentación es mayor en mid-market, que corre 187 apps, que en la pequeña empresa, que corre 87.","hacer":"Concentrar roadmap y soporte en los cuatro primeros y mover el resto a mantención. Ver la matriz de cartera de esta misma pestaña.","impacto":"medio"},{"n":8,"decision":"El mercado grande y el mercado alcanzable no son el mismo","oferta":"El producto compite de igual a igual con proveedores locales, pero contra Microsoft, Google y Shopify no.","demanda":"Norteamérica es el 46% del mercado SaaS mundial, pero la cobertura comercial realista de KIMOS allí es baja; LATAM es solo el 5,6% y es donde tiene ventaja de idioma, cercanía y soporte.","hacer":"Financiar la expansión global con la caja del mercado hispano, no al revés. Entrar a Norteamérica por producto, no por fuerza de ventas.","impacto":"medio"}],"notas":["1. 140 de 154 precios fueron verificados en fuente. Los 14 restantes dicen 'Estimado' en la columna J.","2. Precios de lista públicos al 16-ago-2026, sin descuentos por volumen ni negociación.","3. La normalización compara costo total, no paridad funcional. Revisar features antes de anclar precio.","4. Agicap, Cvent y Salsify no publican precio: sus cifras son estimaciones de mercado.","5. La mediana excluye planes Enterprise (Akeneo, Salsify, Cvent, Bizzabo, Kissflow, Nintex): son otro segmento y distorsionan la referencia.","6. Digitai y Agentes se solapan como categoría. Evaluar fusionarlos en un solo módulo."]};

/* ------------------------------------------------------------------ *
 * Supuestos por defecto (los mismos con los que se levantó el estudio)
 * ------------------------------------------------------------------ */

const SUP_BASE = {
  usuarios: DATA.supuestos.usuarios,
  canales: DATA.supuestos.canales,
  factor: DATA.supuestos.factor,
  descAnual: DATA.supuestos.descAnual,
  gastoSuites: DATA.demanda.params.gastoSuites.valor,
  pymeShare: DATA.demanda.params.pymeShare.valor,
  segmento: DATA.demanda.params.segmento.valor,
  churn: DATA.demanda.params.churn.valor,
  margen: DATA.demanda.params.margen.valor,
  cac: DATA.demanda.params.cac.valor,
  clientes3: DATA.demanda.params.clientes3.valor,
};

const DESC_BASE = {};
DATA.planes.concat(DATA.kits).forEach((p) => { DESC_BASE[p.id] = p.desc; });

const MIX_BASE = {};
DATA.demanda.mixPlan.forEach((m) => { MIX_BASE[m.plan.toLowerCase()] = m.peso; });

// Reparto de la captación entre los tres años (misma forma que la planilla).
const COHORTES = [0.109090909090909, 0.290909090909091, 0.6];

function estadoInicial() {
  return {
    v: 1,
    tab: 'resumen',
    sup: Object.assign({}, SUP_BASE),
    desc: Object.assign({}, DESC_BASE),
    mix: Object.assign({}, MIX_BASE),
    alcance: { region: '', idioma: '', prioridad: '', pais: '' },
    filtro: { q: '', app: '', seg: '', conf: '' },
    orden: { mod: { key: 'sugerido', dir: -1 }, comp: { key: 'costo', dir: -1 } },
    sel: null,
    supAbierto: false,
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

/**
 * Normaliza el precio de un competidor al cliente tipo: por usuario se
 * multiplica por la dotación, por canal por los canales conectados y la tarifa
 * plana se toma tal cual. Es la única forma de comparar manzanas con manzanas.
 */
function costoTipo(c, sup) {
  const mult = c.unidad === 'Por usuario' ? sup.usuarios : c.unidad === 'Por canal' ? sup.canales : 1;
  return c.precio * mult;
}

function calcularOferta(sup, desc) {
  const porApp = new Map();
  DATA.competidores.forEach((c) => {
    if (!porApp.has(c.app)) porApp.set(c.app, []);
    porApp.get(c.app).push(c);
  });

  const modulos = DATA.modulos.map((m) => {
    const rows = porApp.get(m.app) || [];
    // Los planes Enterprise se excluyen de la mediana (son otro segmento) pero
    // sí marcan el techo del mercado.
    const pyme = rows.filter((c) => c.seg !== 'Enterprise').map((c) => costoTipo(c, sup));
    const todos = rows.map((c) => costoTipo(c, sup));
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
    });
  });

  const byN = new Map(modulos.map((m) => [m.n, m]));
  const armar = (p) => {
    const suma = p.mods.reduce((a, n) => a + byN.get(n).sugerido, 0);
    const d = desc[p.id] != null ? desc[p.id] : p.desc;
    const mensual = Math.round(suma * (1 - d));
    const anual = Math.round(mensual * 12 * (1 - sup.descAnual));
    return Object.assign({}, p, {
      suma: suma,
      descuento: d,
      mensual: mensual,
      porUsuario: Math.round((mensual / sup.usuarios) * 10) / 10,
      anual: anual,
      ahorroAnual: suma * 12 - anual,
      nombres: p.mods.map((n) => byN.get(n).app),
    });
  };

  const planes = DATA.planes.map(armar);
  const kits = DATA.kits.map(armar);

  const stack = DATA.stack.map((s) => {
    const c = DATA.competidores[s.comp];
    return {
      necesidad: s.necesidad, herramienta: s.herramienta, plan: s.plan,
      unidad: c.unidad, costo: costoTipo(c, sup),
    };
  });
  const stackTotal = stack.reduce((a, s) => a + s.costo, 0);
  const ent = planes[planes.length - 1];

  const medianaCartera = mediana(modulos.map((m) => m.med));
  modulos.forEach((m) => {
    const paga = m.med >= medianaCartera;
    const ventaja = m.ventaja >= 5.5;
    m.cuadrante = paga && ventaja ? 'APOSTAR'
      : paga && !ventaja ? 'MONETIZAR CON CUIDADO'
      : ventaja ? 'DIFERENCIAR, NO FACTURAR' : 'REPLANTEAR';
  });

  return {
    modulos: modulos,
    byN: byN,
    planes: planes,
    kits: kits,
    aLaCarta: modulos.reduce((a, m) => a + m.sugerido, 0),
    medianaTotal: modulos.reduce((a, m) => a + m.med, 0),
    medianaCartera: medianaCartera,
    stack: stack,
    stackTotal: stackTotal,
    stackPorUsuario: stackTotal / sup.usuarios,
    ratioStack: stackTotal ? ent.mensual / stackTotal : 0,
    ahorroAnualStack: (stackTotal - ent.mensual) * 12,
  };
}

function paisesEnAlcance(alcance) {
  return DATA.demanda.paises.filter((p) => {
    if (alcance.pais && p.pais !== alcance.pais) return false;
    if (alcance.region && p.region !== alcance.region) return false;
    if (alcance.idioma && p.idioma !== alcance.idioma) return false;
    if (alcance.prioridad && p.prioridad !== alcance.prioridad) return false;
    return true;
  });
}

function calcularDemanda(sup, alcance, oferta, mix) {
  const saasReg = new Map(DATA.demanda.regiones.map((r) => [r.region, r.saas]));
  const filas = paisesEnAlcance(alcance).map((p) => {
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

const nf = {};
const fmt = (d) => (nf[d] || (nf[d] = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: d, maximumFractionDigits: d,
})));

const usd = (n) => '$' + fmt(0).format(Math.round(n || 0));
const usd1 = (n) => '$' + fmt(1).format(n || 0);
const mm = (n) => '$' + fmt(0).format(Math.round(n || 0)) + ' MM';
const pct = (n, d) => fmt(d == null ? 1 : d).format((n || 0) * 100) + '%';
const x1 = (n) => fmt(1).format(n || 0);
const x2 = (n) => fmt(2).format(n || 0);          // índice de precio y factor: 0,91 no es 0,9
const num = (n) => fmt(0).format(Math.round(n || 0));

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  let estado = estadoInicial();
  const oyentes = new Set();
  let guardar = null;

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

  let timer = null;
  function programarGuardado() {
    if (!shell || typeof shell.saveData !== 'function') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { v, tab, sup, desc, mix, alcance } = estado;
      Promise.resolve(shell.saveData({ v, tab, sup, desc, mix, alcance })).catch(() => {});
    }, 800);
  }

  async function restaurar() {
    if (!shell || typeof shell.loadData !== 'function') return;
    try {
      const d = await shell.loadData();
      if (!d || typeof d !== 'object') return;
      const patch = {};
      if (d.tab) patch.tab = d.tab;
      if (d.sup) patch.sup = Object.assign({}, SUP_BASE, d.sup);
      if (d.desc) patch.desc = Object.assign({}, DESC_BASE, d.desc);
      if (d.mix) patch.mix = Object.assign({}, MIX_BASE, d.mix);
      if (d.alcance) patch.alcance = Object.assign({ region: '', idioma: '', prioridad: '', pais: '' }, d.alcance);
      estado = Object.assign({}, estado, patch);
      oyentes.forEach((f) => f(estado));
    } catch (e) { /* primera apertura: sin datos guardados */ }
  }

  function descargar(nombre, texto) {
    try {
      const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
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

  const csv = (filas) => filas
    .map((f) => f.map((c) => {
      const s = c == null ? '' : String(c);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';'))
    .join('\n');

  function exportar(oferta, demanda) {
    if (estado.tab === 'competencia') {
      return descargar('kimos-competencia.csv', csv([
        ['App KIMOS', 'Competidor', 'Plan', 'Precio USD/mes', 'Unidad', 'Costo cliente tipo', 'Segmento', 'Notas', 'Fuente', 'Confianza'],
      ].concat(DATA.competidores.map((c) => [
        c.app, c.comp, c.plan, c.precio, c.unidad, Math.round(costoTipo(c, estado.sup)), c.seg, c.nota, c.fuente, c.conf,
      ]))));
    }
    if (estado.tab === 'mercados') {
      return descargar('kimos-mercados.csv', csv([
        ['País', 'Región', 'Idioma', 'Prioridad', 'Cobertura', 'Mercado SaaS USD MM', 'TAM USD MM', 'SAM USD MM', 'Índice precio', 'Starter', 'Business', 'Enterprise'],
      ].concat(demanda.filas.map((f) => {
        const p = (id) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || {}).mensual * f.indice);
        return [f.pais, f.region, f.idioma, f.prioridad, f.cobertura, Math.round(f.saas),
          Math.round(f.tam), Math.round(f.sam), f.indice, p('starter'), p('business'), p('enterprise')];
      }))));
    }
    return descargar('kimos-modulos.csv', csv([
      ['#', 'App KIMOS', 'Categoría', 'Alternativas', 'Mín', 'Mediana', 'Máx', 'Precio sugerido', 'Por usuario', 'Ahorro vs mediana', 'Cuadrante', 'Estrategia'],
    ].concat(oferta.modulos.map((m) => [
      m.n, m.app, m.cat, m.alt, Math.round(m.min), Math.round(m.med), Math.round(m.max),
      m.sugerido, m.porUsuario, pct(m.ahorro, 0), m.cuadrante, m.estrategia,
    ]))));
  }

  /* ---------------------------- piezas de UI ---------------------------- */

  const kpi = (label, valor, nota, tono) => h('div', { className: 'km-kpi' + (tono ? ' km-' + tono : ''), key: label },
    h('div', { className: 'km-kpi-l' }, label),
    h('div', { className: 'km-kpi-v' }, valor),
    nota ? h('div', { className: 'km-kpi-n' }, nota) : null);

  const seccion = (titulo, bajada, hijos, key) => h('section', { className: 'km-sec', key: key },
    h('h3', null, titulo),
    bajada ? h('p', { className: 'km-baja' }, bajada) : null,
    hijos);

  const th = (tabla, key, texto, className) => h('th', {
    className: (className || '') + ' km-th-sort' + (estado.orden[tabla].key === key ? ' on' : ''),
    onClick: () => setOrden(tabla, key),
    title: 'Ordenar por ' + texto,
  }, texto, estado.orden[tabla].key === key ? h('span', { className: 'km-caret' }, estado.orden[tabla].dir < 0 ? ' ▼' : ' ▲') : null);

  const barra = (valor, max, titulo) => h('div', { className: 'km-bar', title: titulo },
    h('span', { style: { width: Math.max(2, Math.min(100, max ? (valor / max) * 100 : 0)) + '%' } }));

  const select = (valor, opciones, onChange, vacio) => h('select', {
    className: 'km-in', value: valor, onChange: (e) => onChange(e.target.value),
  }, [h('option', { value: '', key: '' }, vacio)].concat(
    opciones.map((o) => h('option', { value: o, key: o }, o))));

  const numIn = (valor, onChange, step, min, max) => h('input', {
    className: 'km-in km-num', type: 'number', value: valor, step: step || 1,
    min: min == null ? 0 : min, max: max,
    onChange: (e) => onChange(e.target.value),
  });

  const chipConf = (c) => h('span', {
    className: 'km-chip ' + (c === 'Verificado' ? 'km-ok' : c === 'Estimado' ? 'km-warn' : 'km-neutro'),
  }, c);

  /* ------------------------------- pestañas ------------------------------ */

  function vistaResumen(oferta, demanda) {
    const ent = oferta.planes[oferta.planes.length - 1];
    const banda = oferta.ratioStack > 0.60 ? 'riesgo' : oferta.ratioStack < 0.25 ? 'aviso' : 'ok';
    const bandaTxt = banda === 'ok' ? 'Dentro de la banda sana (25%-60%)'
      : banda === 'riesgo' ? 'Sobre 60%: se cae el argumento de ahorro'
      : 'Bajo 25%: se deja margen sobre la mesa';
    const top = oferta.modulos.slice().sort((a, b) => b.sugerido - a.sugerido).slice(0, 6);
    const maxTop = top[0] ? top[0].med : 1;
    const altas = DATA.decisiones.filter((d) => d.impacto === 'alto').slice(0, 4);

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-kpis' },
        kpi('Suite completa a la carta', usd(oferta.aLaCarta) + '/mes', oferta.modulos.length + ' módulos'),
        kpi('KIMOS Enterprise', usd(ent.mensual) + '/mes', usd1(ent.porUsuario) + ' por usuario · ' + usd(ent.anual) + '/año'),
        kpi('Stack que paga hoy el cliente', usd(oferta.stackTotal) + '/mes', DATA.stack.length + ' herramientas sueltas'),
        kpi('KIMOS sobre ese gasto', pct(oferta.ratioStack, 0), bandaTxt, banda === 'ok' ? 'ok' : banda === 'riesgo' ? 'riesgo' : 'aviso'),
        kpi('Ahorro anual para el cliente', usd(oferta.ahorroAnualStack), 'Enterprise contra el stack best-of-breed'),
        kpi('SAM del alcance', mm(demanda.sam), demanda.filas.length + ' mercados · índice ' + x2(demanda.indice)),
        kpi('ARR al año 3', usd(demanda.arr[2]), num(demanda.vivos[2]) + ' clientes vivos'),
        kpi('Penetración necesaria', pct(demanda.penetracion, 2), demanda.penetracion > 0.02 ? 'Sobre 2%: el plan deja de ser realista' : 'Bajo el umbral de alerta (2%)',
          demanda.penetracion > 0.02 ? 'riesgo' : 'ok')),

      seccion('Dónde está el precio del mercado', 'Los seis módulos que más paga el mercado, con el precio sugerido de KIMOS encima. La barra es la mediana de la competencia para el cliente tipo.',
        h('div', { className: 'km-top' }, top.map((m) => h('div', { className: 'km-top-row', key: m.n },
          h('button', { className: 'km-link', onClick: () => commit({ tab: 'modulos', sel: m.n }) }, m.app),
          barra(m.med, maxTop, 'Mediana del mercado'),
          h('span', { className: 'km-top-num' }, usd(m.med)),
          h('span', { className: 'km-top-kimos' }, 'KIMOS ' + usd(m.sugerido)))))),

      seccion('Las decisiones de mayor impacto', 'Cruce del estudio de oferta con el de demanda. Si el dato cambia, la decisión se revisa.',
        h('div', { className: 'km-cards' }, altas.map((d) => h('article', { className: 'km-card', key: d.n },
          h('h4', null, d.decision),
          h('p', null, h('b', null, 'Qué hacer: '), d.hacer))))),

      h('p', { className: 'km-pie' },
        'Precios de lista públicos al ' + DATA.meta.fecha + ', en ' + DATA.meta.moneda + ', sin impuestos. ',
        DATA.competidores.length + ' planes de ' + oferta.modulos.length + ' categorías. ',
        'Cliente tipo: ' + estado.sup.usuarios + ' usuarios y ' + estado.sup.canales + ' canales sociales.'));
  }

  function vistaModulos(oferta) {
    const o = estado.orden.mod;
    const val = (m) => ({
      n: m.n, app: m.app, cat: m.cat, min: m.min, med: m.med, max: m.max,
      sugerido: m.sugerido, ahorro: m.ahorro, ventaja: m.ventaja,
    })[o.key];
    const filas = oferta.modulos.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return c * o.dir;
    });
    const maxMed = Math.max.apply(null, oferta.modulos.map((m) => m.med));
    const sel = estado.sel != null ? oferta.byN.get(estado.sel) : null;

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-kpis km-kpis-4' },
        kpi('Mediana del mercado, suite entera', usd(oferta.medianaTotal) + '/mes'),
        kpi('Precio sugerido a la carta', usd(oferta.aLaCarta) + '/mes', 'Factor ' + x2(estado.sup.factor) + ' sobre la mediana'),
        kpi('Módulos que APOSTAR', String(oferta.modulos.filter((m) => m.cuadrante === 'APOSTAR').length), 'Pagan bien y KIMOS tiene ventaja'),
        kpi('Módulos a REPLANTEAR', String(oferta.modulos.filter((m) => m.cuadrante === 'REPLANTEAR').length), 'Ni precio ni ventaja')),

      h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
        h('thead', null, h('tr', null,
          th('mod', 'app', 'App KIMOS'),
          th('mod', 'cat', 'Categoría de mercado'),
          h('th', null, 'Alternativas'),
          th('mod', 'min', 'Mín', 'km-r'),
          th('mod', 'med', 'Mediana', 'km-r'),
          th('mod', 'max', 'Máx', 'km-r'),
          h('th', { className: 'km-w' }, 'Mercado'),
          th('mod', 'sugerido', 'KIMOS', 'km-r'),
          h('th', { className: 'km-r' }, 'Por usuario'),
          th('mod', 'ahorro', 'Ahorro', 'km-r'),
          h('th', null, 'Cuadrante'))),
        h('tbody', null, filas.map((m) => h('tr', {
          key: m.n,
          className: estado.sel === m.n ? 'on' : '',
          onClick: () => commit({ sel: estado.sel === m.n ? null : m.n }),
        },
          h('td', null, h('b', null, m.app)),
          h('td', { className: 'km-mut' }, m.cat),
          h('td', { className: 'km-mut km-alt' }, m.alt),
          h('td', { className: 'km-r' }, usd(m.min)),
          h('td', { className: 'km-r' }, usd(m.med)),
          h('td', { className: 'km-r km-mut' }, usd(m.max)),
          h('td', { className: 'km-w' }, barra(m.med, maxMed, 'Mediana ' + usd(m.med))),
          h('td', { className: 'km-r km-fuerte' }, usd(m.sugerido)),
          h('td', { className: 'km-r km-mut' }, usd1(m.porUsuario)),
          h('td', { className: 'km-r' }, pct(m.ahorro, 0)),
          h('td', null, h('span', { className: 'km-cuad km-q' + m.cuadrante.charAt(0) }, m.cuadrante))))))),

      sel ? h('aside', { className: 'km-detalle' },
        h('div', { className: 'km-detalle-h' },
          h('h3', null, sel.app),
          h('button', { className: 'km-x', onClick: () => commit({ sel: null }), title: 'Cerrar' }, '✕')),
        h('p', { className: 'km-baja' }, sel.que, ' · ', sel.cat, ' · Objetivo: ', sel.target),
        h('div', { className: 'km-kpis km-kpis-4' },
          kpi('Mediana del mercado', usd(sel.med) + '/mes'),
          kpi('Precio sugerido', usd(sel.sugerido) + '/mes', usd1(sel.porUsuario) + ' por usuario'),
          kpi('Rango del mercado', usd(sel.min) + ' – ' + usd(sel.max)),
          kpi('Precios verificados', sel.conf, sel.planes + ' planes levantados')),
        h('div', { className: 'km-dos' },
          h('div', { className: 'km-caja km-caja-ok' }, h('h4', null, 'A favor de KIMOS'), h('p', null, sel.pro)),
          h('div', { className: 'km-caja km-caja-riesgo' }, h('h4', null, 'En contra'), h('p', null, sel.contra))),
        h('p', { className: 'km-estrategia' }, h('b', null, 'Estrategia: '), sel.estrategia),
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla km-mini' },
          h('thead', null, h('tr', null, h('th', null, 'Competidor'), h('th', null, 'Plan'),
            h('th', { className: 'km-r' }, 'Precio'), h('th', null, 'Unidad'),
            h('th', { className: 'km-r' }, 'Cliente tipo'), h('th', null, 'Notas'), h('th', null, 'Fuente'))),
          h('tbody', null, DATA.competidores.filter((c) => c.app === sel.app).map((c, i) => h('tr', { key: i },
            h('td', null, c.comp), h('td', { className: 'km-mut' }, c.plan),
            h('td', { className: 'km-r' }, usd1(c.precio)),
            h('td', { className: 'km-mut' }, c.unidad + (c.seg === 'Enterprise' ? ' · Enterprise' : '')),
            h('td', { className: 'km-r km-fuerte' }, usd(costoTipo(c, estado.sup))),
            h('td', { className: 'km-mut' }, c.nota),
            h('td', { className: 'km-fuente' }, c.fuente)))))))
        : h('p', { className: 'km-pie' }, 'Haz clic en una fila para ver los planes de la competencia, los argumentos a favor y en contra, y la estrategia sugerida.'));
  }

  function vistaCompetencia() {
    const f = estado.filtro;
    const q = f.q.trim().toLowerCase();
    let filas = DATA.competidores.map((c, i) => Object.assign({ i: i, costo: costoTipo(c, estado.sup) }, c));
    if (f.app) filas = filas.filter((c) => c.app === f.app);
    if (f.seg) filas = filas.filter((c) => c.seg === f.seg);
    if (f.conf) filas = filas.filter((c) => c.conf === f.conf);
    if (q) filas = filas.filter((c) => (c.comp + ' ' + c.plan + ' ' + c.app + ' ' + c.nota).toLowerCase().indexOf(q) >= 0);
    const o = estado.orden.comp;
    filas.sort((a, b) => {
      const x = a[o.key], y = b[o.key];
      const c = typeof x === 'string' ? x.localeCompare(y) : (x || 0) - (y || 0);
      return c * o.dir;
    });
    const verificados = filas.filter((c) => c.conf === 'Verificado').length;

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-filtros' },
        h('input', { className: 'km-in km-q', placeholder: 'Buscar competidor, plan o nota…', value: f.q, onChange: (e) => setFiltro('q', e.target.value) }),
        select(f.app, DATA.modulos.map((m) => m.app), (v) => setFiltro('app', v), 'Todas las apps'),
        select(f.seg, ['PyME / Empresa', 'Enterprise'], (v) => setFiltro('seg', v), 'Todos los segmentos'),
        select(f.conf, ['Verificado', 'Estimado'], (v) => setFiltro('conf', v), 'Toda confianza'),
        h('span', { className: 'km-cuenta' }, filas.length + ' planes · ' + verificados + ' verificados'),
        (f.q || f.app || f.seg || f.conf) ? h('button', { className: 'km-btn', onClick: () => commit({ filtro: { q: '', app: '', seg: '', conf: '' } }) }, 'Limpiar') : null),

      h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
        h('thead', null, h('tr', null,
          th('comp', 'app', 'App KIMOS'),
          th('comp', 'comp', 'Competidor'),
          th('comp', 'plan', 'Plan'),
          th('comp', 'precio', 'Precio lista', 'km-r'),
          h('th', null, 'Unidad'),
          th('comp', 'costo', 'Cliente tipo', 'km-r'),
          h('th', null, 'Notas'),
          h('th', null, 'Fuente'),
          th('comp', 'conf', 'Confianza'))),
        h('tbody', null, filas.map((c) => h('tr', { key: c.i },
          h('td', { className: 'km-mut' }, c.app),
          h('td', null, h('b', null, c.comp)),
          h('td', { className: 'km-mut' }, c.plan),
          h('td', { className: 'km-r' }, usd1(c.precio)),
          h('td', { className: 'km-mut' }, c.unidad + (c.seg === 'Enterprise' ? ' · Enterprise' : '')),
          h('td', { className: 'km-r km-fuerte' }, usd(c.costo)),
          h('td', { className: 'km-mut' }, c.nota),
          h('td', { className: 'km-fuente' }, c.fuente),
          h('td', null, chipConf(c.conf))))))),

      h('p', { className: 'km-pie' }, 'El costo del cliente tipo normaliza cada plan a ' + estado.sup.usuarios
        + ' usuarios y ' + estado.sup.canales + ' canales. Los planes Enterprise se excluyen de la mediana: son otro segmento y distorsionan la referencia.'));
  }

  function vistaPrecios(oferta) {
    const filaPlan = (p) => h('tr', { key: p.id },
      h('td', null, h('b', null, p.nombre), h('div', { className: 'km-mut' }, p.para)),
      h('td', { className: 'km-mut km-alt' }, p.incluye, h('div', { className: 'km-mods' }, p.nombres.join(' · '))),
      h('td', { className: 'km-r km-mut' }, usd(p.suma)),
      h('td', { className: 'km-r' }, h('div', { className: 'km-desc' },
        numIn(Math.round(p.descuento * 100), (v) => setDesc(p.id, Number(v) / 100), 1, 0, 95), h('span', null, '%'))),
      h('td', { className: 'km-r km-fuerte km-grande' }, usd(p.mensual)),
      h('td', { className: 'km-r km-mut' }, usd1(p.porUsuario)),
      h('td', { className: 'km-r' }, usd(p.anual)),
      h('td', { className: 'km-r km-mut' }, usd(p.ahorroAnual)));

    const cab = h('thead', null, h('tr', null,
      h('th', null, 'Plan'), h('th', null, 'Qué incluye'),
      h('th', { className: 'km-r' }, 'Suma a la carta'), h('th', { className: 'km-r' }, 'Descuento'),
      h('th', { className: 'km-r' }, 'Mensual'), h('th', { className: 'km-r' }, 'Por usuario'),
      h('th', { className: 'km-r' }, 'Anual'), h('th', { className: 'km-r' }, 'Ahorro del cliente')));

    const banda = oferta.ratioStack > 0.60 ? 'riesgo' : oferta.ratioStack < 0.25 ? 'aviso' : 'ok';

    return h('div', { className: 'km-grid' },
      seccion('Planes por tamaño de empresa', 'El descuento es editable: al cambiarlo se recalculan el precio mensual, el anual y el ahorro del cliente.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' }, cab, h('tbody', null, oferta.planes.map(filaPlan))))),

      seccion('Kits por necesidad', 'La oferta de entrada por defecto: menos firmas en el comité, ciclo de venta más corto.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' }, cab, h('tbody', null, oferta.kits.map(filaPlan))))),

      seccion('Chequeo de realidad: qué gasta hoy el cliente sin KIMOS',
        'Stack best-of-breed equivalente, normalizado al mismo cliente tipo. La banda sana deja a KIMOS entre 25% y 60% de ese gasto.',
        h('div', null,
          h('div', { className: 'km-kpis km-kpis-4' },
            kpi('Stack actual', usd(oferta.stackTotal) + '/mes', usd1(oferta.stackPorUsuario) + ' por usuario'),
            kpi('KIMOS Enterprise', usd(oferta.planes[3].mensual) + '/mes', usd1(oferta.planes[3].porUsuario) + ' por usuario'),
            kpi('KIMOS sobre el gasto actual', pct(oferta.ratioStack, 0), banda === 'ok' ? 'Banda sana' : banda === 'riesgo' ? 'Sobre 60%' : 'Bajo 25%', banda),
            kpi('Ahorro anual', usd(oferta.ahorroAnualStack))),
          h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
            h('thead', null, h('tr', null, h('th', null, 'Necesidad'), h('th', null, 'Herramienta que se usa hoy'),
              h('th', null, 'Plan'), h('th', null, 'Unidad'), h('th', { className: 'km-r' }, 'Costo mensual'))),
            h('tbody', null, oferta.stack.map((s, i) => h('tr', { key: i },
              h('td', null, s.necesidad), h('td', null, h('b', null, s.herramienta)),
              h('td', { className: 'km-mut' }, s.plan), h('td', { className: 'km-mut' }, s.unidad),
              h('td', { className: 'km-r' }, usd(s.costo)))).concat([
                h('tr', { key: 'tot', className: 'km-total' },
                  h('td', { colSpan: 4 }, 'TOTAL stack best-of-breed'),
                  h('td', { className: 'km-r' }, usd(oferta.stackTotal))),
              ])))))),

      seccion('Precio a la carta por módulo', 'Módulo suelto, para cotizaciones fuera de plan.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, h('th', null, 'Módulo'), h('th', { className: 'km-r' }, 'Mediana del mercado'),
            h('th', { className: 'km-r' }, 'Precio sugerido'), h('th', { className: 'km-r' }, 'Posición vs mercado'),
            h('th', null, 'Estrategia'))),
          h('tbody', null, oferta.modulos.map((m) => h('tr', { key: m.n },
            h('td', null, m.app), h('td', { className: 'km-r km-mut' }, usd(m.med)),
            h('td', { className: 'km-r km-fuerte' }, usd(m.sugerido)),
            h('td', { className: 'km-r' }, m.med ? pct(m.sugerido / m.med - 1, 0) : '—'),
            h('td', { className: 'km-mut km-alt' }, m.estrategia))).concat([
              h('tr', { key: 'tot', className: 'km-total' },
                h('td', null, 'TOTAL suite completa'),
                h('td', { className: 'km-r' }, usd(oferta.medianaTotal)),
                h('td', { className: 'km-r' }, usd(oferta.aLaCarta)),
                h('td', { className: 'km-r' }, pct(oferta.aLaCarta / oferta.medianaTotal - 1, 0)),
                h('td', null, '')),
            ]))))));
  }

  function vistaMercados(oferta, demanda) {
    const a = estado.alcance;
    const uniq = (k) => Array.from(new Set(DATA.demanda.paises.map((p) => p[k]))).sort();
    const maxSam = Math.max.apply(null, demanda.filas.map((f) => f.sam).concat([1]));
    const precio = (id, ix) => Math.round((oferta.planes.filter((x) => x.id === id)[0] || { mensual: 0 }).mensual * ix);
    const recomendacion = (ix) => ix >= 0.95 ? 'Subir el factor a 0,85–0,90'
      : ix >= 0.75 ? 'Lista regional, factor 0,7'
      : ix >= 0.55 ? 'Mantener factor 0,55' : 'Solo autoservicio';
    const filas = demanda.filas.slice().sort((x, y) => y.sam - x.sam);

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-filtros' },
        select(a.region, uniq('region'), (v) => setAlcance('region', v), 'Todas las regiones'),
        select(a.pais, DATA.demanda.paises.map((p) => p.pais), (v) => setAlcance('pais', v), 'Todos los países'),
        select(a.idioma, uniq('idioma'), (v) => setAlcance('idioma', v), 'Todos los idiomas'),
        select(a.prioridad, uniq('prioridad'), (v) => setAlcance('prioridad', v), 'Toda prioridad comercial'),
        h('span', { className: 'km-cuenta' }, demanda.filas.length + ' de ' + DATA.demanda.paises.length + ' mercados'),
        (a.region || a.pais || a.idioma || a.prioridad)
          ? h('button', { className: 'km-btn', onClick: () => commit({ alcance: { region: '', idioma: '', prioridad: '', pais: '' } }) }, 'Alcance global') : null),

      h('div', { className: 'km-kpis' },
        kpi('Mercado SaaS del alcance', mm(demanda.mercado)),
        kpi('TAM', mm(demanda.tam), 'Suites de gestión en PyME y mid-market'),
        kpi('SAM', mm(demanda.sam), 'Con la cobertura comercial de cada país'),
        kpi('Índice de precio', x2(demanda.indice), 'Ponderado por SAM · 1,00 = lista EE.UU.'),
        kpi('ARPU anual del alcance', usd(demanda.arpuAnual), 'Base ' + usd(demanda.arpuAnualBase) + ' × índice'),
        kpi('Penetración al año 3', pct(demanda.penetracion, 2),
          demanda.penetracion > 0.02 ? 'Sobre 2%: alcance demasiado chico para el plan' : 'Bajo el umbral de alerta',
          demanda.penetracion > 0.02 ? 'riesgo' : 'ok')),

      h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
        h('thead', null, h('tr', null,
          h('th', null, 'Mercado'), h('th', null, 'Región'), h('th', null, 'Idioma'),
          h('th', null, 'Prioridad'), h('th', { className: 'km-r' }, 'Cobertura'),
          h('th', { className: 'km-r' }, 'SaaS'), h('th', { className: 'km-r' }, 'TAM'),
          h('th', { className: 'km-r' }, 'SAM'), h('th', { className: 'km-w' }, ''),
          h('th', { className: 'km-r' }, 'Índice'), h('th', { className: 'km-r' }, 'Starter'),
          h('th', { className: 'km-r' }, 'Business'), h('th', { className: 'km-r' }, 'Enterprise'),
          h('th', null, 'Recomendación'))),
        h('tbody', null, filas.map((f) => h('tr', { key: f.pais, title: f.contexto },
          h('td', null, h('b', null, f.pais)),
          h('td', { className: 'km-mut' }, f.region),
          h('td', { className: 'km-mut' }, f.idioma),
          h('td', null, h('span', { className: 'km-prio km-p' + f.prioridad.charAt(0) }, f.prioridad)),
          h('td', { className: 'km-r km-mut' }, pct(f.cobertura, 0)),
          h('td', { className: 'km-r km-mut' }, mm(f.saas)),
          h('td', { className: 'km-r km-mut' }, mm(f.tam)),
          h('td', { className: 'km-r km-fuerte' }, mm(f.sam)),
          h('td', { className: 'km-w' }, barra(f.sam, maxSam, 'SAM ' + mm(f.sam))),
          h('td', { className: 'km-r' }, x2(f.indice)),
          h('td', { className: 'km-r' }, usd(precio('starter', f.indice))),
          h('td', { className: 'km-r' }, usd(precio('business', f.indice))),
          h('td', { className: 'km-r' }, usd(precio('enterprise', f.indice))),
          h('td', { className: 'km-mut' }, recomendacion(f.indice))))))),

      seccion('Regiones', 'Los totales por región difieren de la suma por país: la hoja por país usa la cobertura comercial de cada mercado, más fina que la cobertura regional.',
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, h('th', null, 'Región'), h('th', { className: 'km-r' }, 'Mercado SaaS'),
            h('th', { className: 'km-r' }, '% global'), h('th', { className: 'km-r' }, 'CAGR'),
            h('th', { className: 'km-r' }, 'Cobertura'), h('th', { className: 'km-r' }, 'Índice'),
            h('th', null, 'Lectura'), h('th', null, 'Confianza'))),
          h('tbody', null, DATA.demanda.regiones.map((r) => h('tr', { key: r.region },
            h('td', null, h('b', null, r.region)),
            h('td', { className: 'km-r' }, mm(r.saas)),
            h('td', { className: 'km-r km-mut' }, pct(r.share, 1)),
            h('td', { className: 'km-r km-mut' }, pct(r.cagr, 1)),
            h('td', { className: 'km-r km-mut' }, pct(r.cobertura, 0)),
            h('td', { className: 'km-r' }, x2(r.indice)),
            h('td', { className: 'km-mut km-alt' }, r.lectura),
            h('td', null, chipConf(r.conf)))))))));
  }

  function vistaEconomia(oferta, demanda) {
    const s = estado.sup;
    const maxArr = Math.max.apply(null, demanda.arr.concat([1]));
    const alerta = demanda.ratio < 2.5;

    return h('div', { className: 'km-grid' },
      h('div', { className: 'km-kpis' },
        kpi('ARPU mensual base', usd(demanda.arpuMensual), 'Mix ' + pct(estado.mix.starter, 0) + ' Starter · '
          + pct(estado.mix.business, 0) + ' Business · ' + pct(estado.mix.enterprise, 0) + ' Enterprise'),
        kpi('ARPU anual del alcance', usd(demanda.arpuAnual), 'Índice ' + x2(demanda.indice)),
        kpi('Vida media del cliente', x1(demanda.vidaMedia) + ' meses', 'Inversa del churn ' + pct(s.churn, 1)),
        kpi('LTV', usd(demanda.ltv), 'ARPU × margen × vida media'),
        kpi('LTV : CAC', x1(demanda.ratio) + ' : 1', alerta ? 'Bajo el benchmark PyME (2,5:1)' : 'Sobre el benchmark PyME (2,5:1)', alerta ? 'riesgo' : 'ok'),
        kpi('CAC payback', x1(demanda.payback) + ' meses', demanda.payback > 12 ? 'Sobre los 12 meses objetivo' : 'Benchmark PyME: 6,2 meses',
          demanda.payback > 12 ? 'riesgo' : 'ok')),

      seccion('Proyección a 3 años', 'Cada cohorte se capta repartida en 12 meses y se le aplica supervivencia mes a mes. Sin ese descuento el churn no afectaría el ARR y la proyección sería falsa.',
        h('div', null,
          h('div', { className: 'km-anios' }, [0, 1, 2].map((i) => h('div', { className: 'km-anio', key: i },
            h('div', { className: 'km-anio-l' }, 'Año ' + (i + 1)),
            h('div', { className: 'km-anio-v' }, usd(demanda.arr[i])),
            h('div', { className: 'km-anio-b' }, h('span', { style: { width: (demanda.arr[i] / maxArr) * 100 + '%' } })),
            h('div', { className: 'km-anio-n' }, num(demanda.vivos[i]) + ' clientes vivos')))),
          h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
            h('thead', null, h('tr', null, h('th', null, 'Cohorte'), h('th', { className: 'km-r' }, 'Clientes nuevos'),
              h('th', { className: 'km-r' }, 'Vivos al cierre año 1'), h('th', { className: 'km-r' }, 'Año 2'), h('th', { className: 'km-r' }, 'Año 3'))),
            h('tbody', null, demanda.cohortes.map((c) => h('tr', { key: c.anio },
              h('td', null, 'Captados en el año ' + c.anio),
              h('td', { className: 'km-r' }, num(c.nuevos)),
              h('td', { className: 'km-r km-mut' }, c.vivos[0] ? num(c.vivos[0]) : '—'),
              h('td', { className: 'km-r km-mut' }, c.vivos[1] ? num(c.vivos[1]) : '—'),
              h('td', { className: 'km-r km-mut' }, c.vivos[2] ? num(c.vivos[2]) : '—'))).concat([
                h('tr', { key: 'tot', className: 'km-total' },
                  h('td', null, 'Clientes vivos'),
                  h('td', { className: 'km-r' }, num(s.clientes3)),
                  h('td', { className: 'km-r' }, num(demanda.vivos[0])),
                  h('td', { className: 'km-r' }, num(demanda.vivos[1])),
                  h('td', { className: 'km-r' }, num(demanda.vivos[2]))),
                h('tr', { key: 'arr', className: 'km-total' },
                  h('td', null, 'ARR'), h('td', { className: 'km-r' }, ''),
                  h('td', { className: 'km-r' }, usd(demanda.arr[0])),
                  h('td', { className: 'km-r' }, usd(demanda.arr[1])),
                  h('td', { className: 'km-r' }, usd(demanda.arr[2]))),
              ])))))),

      seccion('Mix de planes', 'Cuánto pesa cada plan en la base de clientes. Mueve el mix y el ARPU, el LTV y el ARR se recalculan.',
        h('div', { className: 'km-mixes' }, ['starter', 'business', 'enterprise'].map((k) => {
          const p = oferta.planes.filter((x) => x.id === k)[0];
          return h('label', { className: 'km-mix', key: k },
            h('span', null, p.nombre, h('em', null, usd(p.mensual) + '/mes')),
            numIn(Math.round((estado.mix[k] || 0) * 100), (v) => setMix(k, Number(v) / 100), 5, 0, 100),
            h('span', { className: 'km-mut' }, '%'));
        }).concat([
          h('span', {
            key: 'suma',
            className: 'km-cuenta' + (Math.abs(['starter', 'business', 'enterprise']
              .reduce((a, k) => a + (estado.mix[k] || 0), 0) - 1) > 0.001 ? ' km-riesgo-txt' : ''),
          }, 'Suma del mix: ' + pct(['starter', 'business', 'enterprise'].reduce((a, k) => a + (estado.mix[k] || 0), 0), 0)),
        ]))),

      seccion('Retención', null, h('p', { className: 'km-baja' },
        'De los ' + num(s.clientes3) + ' clientes captados en tres años quedan vivos ' + num(demanda.vivos[2])
        + ' al cierre del año 3: una retención del ' + pct(demanda.retencion, 0)
        + '. Entre el 40% y el 60% del churn ocurre antes del tercer mes, así que esta cifra se gana en el onboarding, no en la venta.')));
  }

  function vistaClientes() {
    return h('div', { className: 'km-grid' },
      seccion('Perfiles de cliente ideal', 'Seis perfiles con el dolor que los mueve, el gatillo de compra y la objeción que hay que responder.',
        h('div', { className: 'km-cards km-cards-3' }, DATA.icp.map((p, i) => h('article', { className: 'km-card', key: i },
          h('h4', null, p.perfil),
          h('div', { className: 'km-tags' },
            h('span', { className: 'km-tag' }, p.rol),
            h('span', { className: 'km-tag' }, p.tamano),
            h('span', { className: 'km-tag km-tag-on' }, p.producto)),
          h('p', null, h('b', null, 'Dolor. '), p.dolor),
          h('p', null, h('b', null, 'Gatillo. '), p.gatillo),
          h('p', { className: 'km-obj' }, h('b', null, 'Objeción. '), p.objecion),
          h('p', null, h('b', null, 'Cómo se le vende. '), p.venta))))),

      seccion('Segmentación por tamaño', null,
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, h('th', null, 'Segmento'), h('th', null, 'Empleados'),
            h('th', null, 'Veredicto'), h('th', null, 'Plan sugerido'), h('th', null, 'Por qué'), h('th', null, 'Riesgo'))),
          h('tbody', null, DATA.segmentos.map((s, i) => h('tr', { key: i },
            h('td', null, h('b', null, s.segmento)), h('td', { className: 'km-mut' }, s.empleados),
            h('td', null, h('span', { className: 'km-vered km-v' + s.veredicto.charAt(0) }, s.veredicto)),
            h('td', { className: 'km-mut' }, s.plan),
            h('td', { className: 'km-mut km-alt' }, s.porque),
            h('td', { className: 'km-mut km-alt' }, s.riesgo))))))),

      DATA.evidencia.map((g, i) => seccion(g.titulo, null,
        h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla' },
          h('thead', null, h('tr', null, g.cols.map((c, j) => h('th', { key: j, className: j === 2 && g.cols.length > 6 ? 'km-r' : '' }, c)))),
          h('tbody', null, g.filas.map((f, j) => h('tr', { key: j },
            f.map((c, k) => h('td', {
              key: k,
              className: (k === g.cols.length - 1 ? '' : 'km-mut') + (k >= 3 ? ' km-alt' : ''),
            }, k === g.cols.length - 1 ? chipConf(c) : c))))))), 'ev' + i)));
  }

  function vistaDecisiones(oferta) {
    // Matriz de cartera: lo que paga el mercado contra la ventaja de KIMOS.
    const W = 720, H = 420, P = 46;
    const maxMed = Math.max.apply(null, oferta.modulos.map((m) => m.med));
    const xs = (v) => P + (v / 10) * (W - P * 2);
    const ys = (v) => H - P - (Math.sqrt(v / maxMed)) * (H - P * 2);

    return h('div', { className: 'km-grid' },
      seccion('Ocho decisiones que solo aparecen al cruzar oferta y demanda', 'Cada una con el dato que la sostiene por ambos lados.',
        h('div', { className: 'km-cards km-cards-2' }, DATA.decisiones.map((d) => h('article', {
          className: 'km-card km-card-' + d.impacto, key: d.n,
        },
          h('div', { className: 'km-card-h' }, h('span', { className: 'km-n' }, d.n),
            h('span', { className: 'km-imp km-i' + d.impacto }, 'impacto ' + d.impacto)),
          h('h4', null, d.decision),
          h('p', null, h('b', null, 'Oferta. '), d.oferta),
          h('p', null, h('b', null, 'Demanda. '), d.demanda),
          h('p', { className: 'km-hacer' }, h('b', null, 'Qué hacer. '), d.hacer))))),

      seccion('Matriz de cartera', 'Eje horizontal: la ventaja de KIMOS (0 a 10). Eje vertical: lo que paga el mercado por la categoría, en escala de raíz. El corte vertical está en la ventaja 5,5 y el horizontal en la mediana de la cartera (' + usd(oferta.medianaCartera) + ').',
        h('div', null,
          h('div', { className: 'km-svg-wrap' }, h('svg', { viewBox: '0 0 ' + W + ' ' + H, className: 'km-svg', role: 'img' },
            h('rect', { x: xs(5.5), y: P - 14, width: W - P - xs(5.5), height: ys(oferta.medianaCartera) - P + 14, className: 'km-q-apostar' }),
            h('rect', { x: P, y: P - 14, width: xs(5.5) - P, height: ys(oferta.medianaCartera) - P + 14, className: 'km-q-cuidado' }),
            h('rect', { x: xs(5.5), y: ys(oferta.medianaCartera), width: W - P - xs(5.5), height: H - P - ys(oferta.medianaCartera), className: 'km-q-difer' }),
            h('text', { x: W - P - 8, y: P + 4, className: 'km-q-lab', textAnchor: 'end' }, 'APOSTAR'),
            h('text', { x: P + 8, y: P + 4, className: 'km-q-lab' }, 'MONETIZAR CON CUIDADO'),
            h('text', { x: W - P - 8, y: H - P - 8, className: 'km-q-lab', textAnchor: 'end' }, 'DIFERENCIAR, NO FACTURAR'),
            h('text', { x: P + 8, y: H - P - 8, className: 'km-q-lab' }, 'REPLANTEAR'),
            h('line', { x1: P, y1: H - P, x2: W - P, y2: H - P, className: 'km-eje' }),
            h('line', { x1: P, y1: P - 14, x2: P, y2: H - P, className: 'km-eje' }),
            oferta.modulos.map((m) => h('g', { key: m.n, className: 'km-pt' },
              h('circle', { cx: xs(m.ventaja), cy: ys(m.med), r: Math.max(5, Math.sqrt(m.sugerido) * 0.9) }),
              h('title', null, m.app + ' — mercado ' + usd(m.med) + '/mes · KIMOS ' + usd(m.sugerido) + '/mes · ventaja ' + m.ventaja + '/10 · ' + m.cuadrante),
              h('text', { x: xs(m.ventaja), y: ys(m.med) - Math.max(9, Math.sqrt(m.sugerido) * 0.9 + 4), textAnchor: 'middle' }, m.app))),
            h('text', { x: W / 2, y: H - 10, textAnchor: 'middle', className: 'km-eje-lab' }, 'Ventaja de KIMOS →'),
            h('text', { x: 14, y: H / 2, textAnchor: 'middle', className: 'km-eje-lab', transform: 'rotate(-90 14 ' + H / 2 + ')' }, 'Lo que paga el mercado →'))),
          h('div', { className: 'km-tabla-wrap' }, h('table', { className: 'km-tabla km-mini' },
            h('thead', null, h('tr', null, h('th', null, 'Cuadrante'), h('th', null, 'Módulos'), h('th', { className: 'km-r' }, 'Precio sugerido'))),
            h('tbody', null, ['APOSTAR', 'MONETIZAR CON CUIDADO', 'DIFERENCIAR, NO FACTURAR', 'REPLANTEAR'].map((q) => {
              const ms = oferta.modulos.filter((m) => m.cuadrante === q);
              return h('tr', { key: q },
                h('td', null, h('span', { className: 'km-cuad km-q' + q.charAt(0) }, q)),
                h('td', { className: 'km-mut' }, ms.map((m) => m.app).join(' · ') || '—'),
                h('td', { className: 'km-r km-fuerte' }, usd(ms.reduce((a, m) => a + m.sugerido, 0)) + '/mes'));
            })))))),

      seccion('Advertencias metodológicas', 'Lo que este estudio no prueba. Leerlo antes de anclar un precio.',
        h('ol', { className: 'km-notas' }, DATA.notas.map((n, i) => h('li', { key: i }, n.replace(/^\d+\.\s*/, ''))))));
  }

  /* ------------------------------ supuestos ------------------------------ */

  function panelSupuestos() {
    const s = estado.sup;
    const campo = (k, label, nota, step, max) => h('label', { className: 'km-campo', key: k },
      h('span', null, label, nota ? h('em', null, nota) : null),
      numIn(s[k], (v) => setSup(k, v), step, 0, max));
    const pctCampo = (k, label, nota, step) => h('label', { className: 'km-campo', key: k },
      h('span', null, label, nota ? h('em', null, nota) : null),
      h('span', { className: 'km-desc' },
        numIn(Math.round(s[k] * 1000) / 10, (v) => setSup(k, Number(v) / 100), step || 1, 0, 100), h('span', null, '%')));

    return h('div', { className: 'km-sup' },
      h('div', { className: 'km-sup-col' },
        h('h4', null, 'Cliente tipo y posicionamiento'),
        campo('usuarios', 'Usuarios', 'normaliza precios por asiento', 1),
        campo('canales', 'Canales sociales', 'normaliza precios por canal', 1),
        h('label', { className: 'km-campo' },
          h('span', null, 'Factor de posicionamiento', h('em', null, '0,55 = challenger')),
          numIn(s.factor, (v) => setSup('factor', v), 0.05, 0, 2)),
        pctCampo('descAnual', 'Descuento por pago anual')),
      h('div', { className: 'km-sup-col' },
        h('h4', null, 'Embudo de mercado'),
        pctCampo('gastoSuites', 'Gasto en suites de gestión', '% del SaaS'),
        pctCampo('pymeShare', 'Participación PyME y mid-market'),
        pctCampo('segmento', 'Segmento 10-250 empleados')),
      h('div', { className: 'km-sup-col' },
        h('h4', null, 'Economía por cliente'),
        pctCampo('churn', 'Churn mensual', 'benchmark PyME: 3% a 7%', 0.1),
        pctCampo('margen', 'Margen bruto', 'castigado por el costo de IA'),
        campo('cac', 'CAC promedio', 'USD', 50),
        campo('clientes3', 'Clientes captados al año 3', 'capacidad comercial', 10)),
      h('div', { className: 'km-sup-pie' },
        h('button', { className: 'km-btn', onClick: () => commit({ sup: Object.assign({}, SUP_BASE), desc: Object.assign({}, DESC_BASE), mix: Object.assign({}, MIX_BASE) }) },
          'Restaurar los supuestos del estudio'),
        h('span', { className: 'km-mut' }, 'Levantamiento: ' + DATA.meta.fecha + ' · ' + DATA.meta.moneda + ' · ' + DATA.competidores.length + ' precios de lista')));
  }

  /* ------------------------------- render ------------------------------- */

  const TABS = [
    ['resumen', 'Resumen'],
    ['modulos', 'Módulos'],
    ['competencia', 'Competencia'],
    ['precios', 'Precios y planes'],
    ['mercados', 'Mercados'],
    ['economia', 'Economía'],
    ['clientes', 'Clientes'],
    ['decisiones', 'Decisiones'],
  ];

  function Component() {
    const [st, setSt] = React.useState(estado);
    React.useEffect(() => {
      oyentes.add(setSt);
      return () => { oyentes.delete(setSt); };
    }, []);

    const oferta = React.useMemo(() => calcularOferta(st.sup, st.desc), [st.sup, st.desc]);
    const demanda = React.useMemo(() => calcularDemanda(st.sup, st.alcance, oferta, st.mix), [st.sup, st.alcance, st.mix, oferta]);

    const alcanceTxt = st.alcance.pais || st.alcance.region || st.alcance.idioma || st.alcance.prioridad || 'Global';

    const cuerpo = st.tab === 'modulos' ? vistaModulos(oferta)
      : st.tab === 'competencia' ? vistaCompetencia()
      : st.tab === 'precios' ? vistaPrecios(oferta)
      : st.tab === 'mercados' ? vistaMercados(oferta, demanda)
      : st.tab === 'economia' ? vistaEconomia(oferta, demanda)
      : st.tab === 'clientes' ? vistaClientes()
      : st.tab === 'decisiones' ? vistaDecisiones(oferta)
      : vistaResumen(oferta, demanda);

    return h('div', { className: 'kimos-mercado' },
      h('header', { className: 'km-head' },
        h('div', { className: 'km-titulo' },
          h('span', { className: 'km-icono' }, '🎯'),
          h('b', null, 'Estudio de Mercado'),
          h('span', { className: 'km-ver', title: 'Estudio de Mercado v' + APP_VERSION }, 'v' + APP_VERSION)),
        h('nav', { className: 'km-tabs' }, TABS.map(([id, label]) => h('button', {
          key: id, className: 'km-tab' + (st.tab === id ? ' on' : ''),
          onClick: () => commit({ tab: id }),
        }, label))),
        h('div', { className: 'km-acciones' },
          h('span', { className: 'km-alcance', title: 'Alcance del análisis de demanda' }, alcanceTxt),
          h('button', { className: 'km-btn' + (st.supAbierto ? ' on' : ''), onClick: () => commit({ supAbierto: !st.supAbierto }) }, '⚙️ Supuestos'),
          h('button', { className: 'km-btn', onClick: () => exportar(oferta, demanda), title: 'Exportar la pestaña actual a CSV' }, '⬇️ CSV'))),
      st.supAbierto ? panelSupuestos() : null,
      h('main', { className: 'km-body' }, cuerpo));
  }

  /* -------------------------------- agente -------------------------------- */

  let desregistrar = null;

  const CLAVES_SUP = Object.keys(SUP_BASE);

  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    desregistrar = shell.agent.register({
      label: 'Estudio de Mercado',
      description: 'Estudio competitivo y de precios de KIMOS: precio sugerido por módulo contra la competencia, planes y kits, mercado por país y economía por cliente. El agente puede mover los supuestos y el alcance, y leer todo lo que se recalcula.',
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
            properties: {
              plan: { type: 'string', enum: Object.keys(DESC_BASE) },
              descuento: { type: 'number' },
            },
            required: ['plan', 'descuento'],
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
            properties: { app: { type: 'string', enum: DATA.modulos.map((m) => m.app) } },
            required: ['app'],
          },
        },
        {
          name: 'RESTAURAR_SUPUESTOS',
          description: 'Vuelve a los supuestos, descuentos y mix con los que se levantó el estudio.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      getSnapshot: () => {
        // Se recalcula al vuelo desde el estado actual: si dependiera del
        // último render, el agente leería cifras viejas tras cambiar supuestos.
        const of = calcularOferta(estado.sup, estado.desc);
        const dem = calcularDemanda(estado.sup, estado.alcance, of, estado.mix);
        return {
          version: APP_VERSION,
          levantamiento: DATA.meta.fecha,
          pestana: estado.tab,
          supuestos: estado.sup,
          alcance: estado.alcance,
          mixPlanes: estado.mix,
          oferta: {
            suiteALaCarta: of.aLaCarta,
            medianaMercado: Math.round(of.medianaTotal),
            stackActualCliente: Math.round(of.stackTotal),
            kimosSobreStack: Math.round(of.ratioStack * 100) / 100,
            ahorroAnualCliente: Math.round(of.ahorroAnualStack),
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
          decisiones: DATA.decisiones.map((d) => ({ n: d.n, decision: d.decision, hacer: d.hacer, impacto: d.impacto })),
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
            if (!(p.plan in DESC_BASE)) return { success: false, error: 'Plan desconocido: ' + p.plan };
            const v = Number(p.descuento);
            if (!isFinite(v) || v < 0 || v > 0.95) return { success: false, error: 'El descuento debe ir entre 0 y 0,95' };
            setDesc(p.plan, v);
            return { success: true, message: p.plan + ' con ' + Math.round(v * 100) + '% de descuento' };
          }
          if (t === 'SET_ALCANCE') {
            const a = { region: '', idioma: '', prioridad: '', pais: '' };
            ['region', 'idioma', 'prioridad', 'pais'].forEach((k) => {
              if (typeof p[k] === 'string') a[k] = p[k];
            });
            if (a.pais && !DATA.demanda.paises.some((x) => x.pais === a.pais)) {
              return { success: false, error: 'País desconocido: ' + a.pais };
            }
            if (a.pais) { a.region = ''; a.idioma = ''; a.prioridad = ''; }
            commit({ alcance: a });
            const n = paisesEnAlcance(a).length;
            if (!n) return { success: false, error: 'Ese alcance no deja ningún mercado dentro' };
            return { success: true, message: n + ' mercados en el alcance' };
          }
          if (t === 'VER_PESTANA') {
            if (!TABS.some((x) => x[0] === p.pestana)) return { success: false, error: 'Pestaña desconocida' };
            commit({ tab: p.pestana });
            return { success: true, message: 'Pestaña ' + p.pestana };
          }
          if (t === 'VER_MODULO') {
            const m = DATA.modulos.filter((x) => x.app === p.app)[0];
            if (!m) return { success: false, error: 'Módulo desconocido: ' + p.app };
            commit({ tab: 'modulos', sel: m.n });
            return { success: true, message: 'Detalle de ' + m.app };
          }
          if (t === 'RESTAURAR_SUPUESTOS') {
            commit({ sup: Object.assign({}, SUP_BASE), desc: Object.assign({}, DESC_BASE), mix: Object.assign({}, MIX_BASE) });
            return { success: true, message: 'Supuestos del estudio restaurados' };
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
