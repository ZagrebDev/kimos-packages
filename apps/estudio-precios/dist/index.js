/**
 * Estudio de Precios KIMOS — dashboard interactivo de estudio de mercado y
 * modelo de suscripción, editable y persistente.
 *
 * FUENTE DE LOS DATOS: el estudio comparativo de agosto de 2026 sobre las 24
 * aplicaciones de KIMOS (154 planes de competencia relevados, 140 verificados
 * contra la tarifa publicada del proveedor). Los 14 restantes son proveedores
 * que no publican precio (Agicap, Cvent, Salsify, Bizzabo) o sitios que no
 * respondieron; van marcados "Estimado" y NO se ocultan: el modelo entero se
 * apoya en medianas y una mediana mal calculada arrastra el error aguas abajo.
 *
 * CÓMO FUNCIONA EL MODELO (todo se recalcula en cada cambio, no hay valores
 * congelados en el archivo):
 *
 *   mediana(planes PyME de la categoría) × factor de posicionamiento
 *     = precio sugerido del módulo
 *   Σ módulos del plan × (1 − descuento de bundle) = precio del plan
 *
 * La mediana excluye deliberadamente los planes Enterprise (Akeneo, Salsify,
 * Cvent, Bizzabo, Kissflow, Nintex): son de otro segmento y distorsionaban la
 * referencia — con ellos dentro, "Gestión de Eventos" sugería USD 1.162/mes.
 * Se siguen mostrando en la tabla y en el rango máximo, pero fuera del cálculo.
 *
 * QUÉ ES EDITABLE (y se guarda por instancia con saveData/loadData): los
 * supuestos del cliente tipo, cada precio de la competencia, filas nuevas o
 * eliminadas, el precio sugerido de cada módulo (override manual), la
 * composición y el descuento de cada plan y kit, el texto de pros/contras y
 * estrategia de cada app, los puntajes del diagnóstico y las notas.
 *
 * El agente IA opera exactamente las mismas mutaciones que la UI.
 */

// Mantener en sincronía con manifest.json y con el catálogo raíz /manifest.json.
const APP_VERSION = '1.0.0';

const DATOS = {
  "sup": {
    "usuarios": 10,
    "canales": 5,
    "factor": 0.55,
    "desc_anual": 0.2,
    "fecha": "2026-08-16"
  },
  "det": [
    {
      "app": "Escritorio Kimos",
      "comp": "ChatGPT Business",
      "plan": "Business",
      "price": 20,
      "unit": "Por usuario",
      "notes": "Enterprise ~USD 60/asiento",
      "src": "coworker.ai/blog/chatgpt-enterprise-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Escritorio Kimos",
      "comp": "ChatGPT Team",
      "plan": "Team",
      "price": 25,
      "unit": "Por usuario",
      "notes": "",
      "src": "coworker.ai/blog/chatgpt-enterprise-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Escritorio Kimos",
      "comp": "Claude Team",
      "plan": "Team",
      "price": 25,
      "unit": "Por usuario",
      "notes": "Mínimo 5 asientos",
      "src": "fusioncomputing.ca/copilot-vs-chatgpt-vs-claude",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Escritorio Kimos",
      "comp": "Microsoft 365 Copilot",
      "plan": "Business",
      "price": 21,
      "unit": "Por usuario",
      "notes": "USD 18 promocional hasta sep-2026; exige licencia M365",
      "src": "geotoolbox.ai/blog/copilot-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Escritorio Kimos",
      "comp": "Manus",
      "plan": "Starter",
      "price": 19,
      "unit": "Plano",
      "notes": "Agente autónomo por créditos",
      "src": "manus.im/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Agentes",
      "comp": "Zapier",
      "plan": "Professional",
      "price": 19.99,
      "unit": "Plano",
      "notes": "Free con 100 tareas/mes",
      "src": "lindy.ai/blog/zapier-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes",
      "comp": "Zapier",
      "plan": "Team",
      "price": 69,
      "unit": "Plano",
      "notes": "Usuarios ilimitados",
      "src": "lindy.ai/blog/zapier-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes",
      "comp": "Lindy",
      "plan": "Plus",
      "price": 49.99,
      "unit": "Plano",
      "notes": "Cobro por créditos, sobreconsumo al doble",
      "src": "coworker.ai/blog/lindy-ai-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes",
      "comp": "Lindy",
      "plan": "Pro",
      "price": 99.99,
      "unit": "Plano",
      "notes": "",
      "src": "coworker.ai/blog/lindy-ai-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes",
      "comp": "Lindy",
      "plan": "Max",
      "price": 199.99,
      "unit": "Plano",
      "notes": "",
      "src": "coworker.ai/blog/lindy-ai-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes",
      "comp": "Notion",
      "plan": "Business (Agents)",
      "price": 20,
      "unit": "Por usuario",
      "notes": "Agentes custom: USD 10 / 1.000 créditos",
      "src": "notion.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Tidio",
      "plan": "Starter",
      "price": 24.17,
      "unit": "Plano",
      "notes": "Pago anual",
      "src": "tidio.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Tidio",
      "plan": "Growth",
      "price": 49.17,
      "unit": "Plano",
      "notes": "Pago anual",
      "src": "tidio.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Tidio",
      "plan": "Plus",
      "price": 300,
      "unit": "Plano",
      "notes": "Pago anual",
      "src": "tidio.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Intercom",
      "plan": "Essential",
      "price": 29,
      "unit": "Por usuario",
      "notes": "Fin AI: USD 0,99 por resolución",
      "src": "flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Intercom",
      "plan": "Advanced",
      "price": 85,
      "unit": "Por usuario",
      "notes": "Incluye 20 asientos Lite",
      "src": "flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Intercom",
      "plan": "Expert",
      "price": 132,
      "unit": "Por usuario",
      "notes": "",
      "src": "flowgent.ai/blog/intercom-chatbot-pricing-guide-and-comparison",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Chatbase",
      "plan": "Standard",
      "price": 120,
      "unit": "Plano",
      "notes": "4.000 créditos; sobrecosto USD 40/1.000",
      "src": "blog.fastbots.ai/ai-chatbot-pricing-comparison",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "Crisp",
      "plan": "Essentials",
      "price": 103,
      "unit": "Plano",
      "notes": "EUR 95 convertidos",
      "src": "featurebase.app/blog/crisp-vs-intercom",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Agentes Web",
      "comp": "ManyChat",
      "plan": "Pro",
      "price": 14,
      "unit": "Plano",
      "notes": "250 contactos activos; USD 139 con 25.000",
      "src": "elfsight.com/blog/how-much-does-a-chatbot-cost",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Archivos",
      "comp": "Google Workspace",
      "plan": "Business Starter",
      "price": 7,
      "unit": "Por usuario",
      "notes": "30 GB por usuario",
      "src": "workspace.google.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Archivos",
      "comp": "Google Workspace",
      "plan": "Business Standard",
      "price": 14,
      "unit": "Por usuario",
      "notes": "2 TB por usuario",
      "src": "workspace.google.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Archivos",
      "comp": "Google Workspace",
      "plan": "Business Plus",
      "price": 22,
      "unit": "Por usuario",
      "notes": "5 TB por usuario",
      "src": "workspace.google.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Archivos",
      "comp": "Dropbox Business",
      "plan": "Standard",
      "price": 15,
      "unit": "Por usuario",
      "notes": "5 TB compartidos",
      "src": "costbench.com/software/document-management/dropbox-business",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Archivos",
      "comp": "Dropbox Business",
      "plan": "Advanced",
      "price": 24,
      "unit": "Por usuario",
      "notes": "Almacenamiento ilimitado",
      "src": "costbench.com/software/document-management/dropbox-business",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Archivos",
      "comp": "Egnyte",
      "plan": "Business",
      "price": 22,
      "unit": "Por usuario",
      "notes": "",
      "src": "egnyte.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Archivos",
      "comp": "Box",
      "plan": "Business",
      "price": 20,
      "unit": "Por usuario",
      "notes": "USD 25 con pago mensual",
      "src": "bestcloudstorageguide.com/blog/box-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Conocimiento",
      "comp": "Confluence",
      "plan": "Standard",
      "price": 5.42,
      "unit": "Por usuario",
      "notes": "",
      "src": "docsie.io/blog/articles/confluence-vs-document360-pricing-comparison-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Conocimiento",
      "comp": "Guru",
      "plan": "All-in-one",
      "price": 25,
      "unit": "Por usuario",
      "notes": "Mínimo 10 asientos",
      "src": "usecarly.com/blog/guru-alternatives",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Conocimiento",
      "comp": "Slite",
      "plan": "Standard",
      "price": 8,
      "unit": "Por usuario",
      "notes": "",
      "src": "slite.com/learn/knowledge-base-softwares",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Conocimiento",
      "comp": "Notion",
      "plan": "Business",
      "price": 20,
      "unit": "Por usuario",
      "notes": "Incluye Enterprise Search",
      "src": "notion.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Conocimiento",
      "comp": "Document360",
      "plan": "Professional",
      "price": 199,
      "unit": "Plano",
      "notes": "Rango 199-499 según uso de IA",
      "src": "docsie.io/blog/articles/confluence-vs-document360-pricing-comparison-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Equipos",
      "comp": "Slack",
      "plan": "Pro",
      "price": 7.25,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "costbench.com/software/communication/slack",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Equipos",
      "comp": "Slack",
      "plan": "Business+",
      "price": 12.5,
      "unit": "Por usuario",
      "notes": "",
      "src": "costbench.com/software/communication/slack",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Equipos",
      "comp": "Microsoft Teams",
      "plan": "Essentials",
      "price": 4,
      "unit": "Por usuario",
      "notes": "Sube a USD 4,50 en jul-2026",
      "src": "getpricepulse.com/companies/slack-vs-microsoft-teams-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Equipos",
      "comp": "Microsoft 365",
      "plan": "Business Basic",
      "price": 6,
      "unit": "Por usuario",
      "notes": "Teams + Office web",
      "src": "getpricepulse.com/companies/slack-vs-microsoft-teams-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Equipos",
      "comp": "Microsoft 365",
      "plan": "Business Standard",
      "price": 12.5,
      "unit": "Por usuario",
      "notes": "Incluye Office escritorio",
      "src": "getpricepulse.com/companies/slack-vs-microsoft-teams-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "Trello",
      "plan": "Standard",
      "price": 5,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "costbench.com/software/project-management/trello",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "Trello",
      "plan": "Premium",
      "price": 10,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "costbench.com/software/project-management/trello",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "Trello",
      "plan": "Enterprise",
      "price": 17.5,
      "unit": "Por usuario",
      "notes": "Mínimo 50 asientos",
      "src": "costbench.com/software/project-management/trello",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "ClickUp",
      "plan": "Unlimited",
      "price": 7,
      "unit": "Por usuario",
      "notes": "",
      "src": "layer3labs.io/guides/clickup-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "ClickUp",
      "plan": "Business",
      "price": 12,
      "unit": "Por usuario",
      "notes": "",
      "src": "layer3labs.io/guides/clickup-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "ClickUp",
      "plan": "Business Plus",
      "price": 19,
      "unit": "Por usuario",
      "notes": "",
      "src": "layer3labs.io/guides/clickup-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "Monday.com",
      "plan": "Basic",
      "price": 9,
      "unit": "Por usuario",
      "notes": "Mínimo 3 asientos",
      "src": "softwarefinder.com/resources/trello-vs-asana-vs-monday-vs-clickup",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "Asana",
      "plan": "Starter",
      "price": 13.49,
      "unit": "Por usuario",
      "notes": "",
      "src": "softwarefinder.com/resources/trello-vs-asana-vs-monday-vs-clickup",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kanban",
      "comp": "Asana",
      "plan": "Advanced",
      "price": 24.99,
      "unit": "Por usuario",
      "notes": "Se factura en bloques de 5",
      "src": "plutio.com/compare/asana-vs-wrike",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "Smartsheet",
      "plan": "Pro",
      "price": 9,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "tech.co/project-management-software/smartsheet-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "Smartsheet",
      "plan": "Business",
      "price": 19,
      "unit": "Por usuario",
      "notes": "",
      "src": "tech.co/project-management-software/smartsheet-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "Wrike",
      "plan": "Team",
      "price": 10,
      "unit": "Por usuario",
      "notes": "2 a 15 usuarios",
      "src": "costbench.com/software/project-management/wrike",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "Wrike",
      "plan": "Business",
      "price": 25,
      "unit": "Por usuario",
      "notes": "Mínimo 5 asientos",
      "src": "costbench.com/software/project-management/wrike",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "Microsoft Project",
      "plan": "Plan 1",
      "price": 10,
      "unit": "Por usuario",
      "notes": "",
      "src": "techrepublic.com/article/microsoft-project-vs-smartsheet",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "Microsoft Project",
      "plan": "Plan 3",
      "price": 30,
      "unit": "Por usuario",
      "notes": "Tier real para gestión de recursos",
      "src": "techrepublic.com/article/microsoft-project-vs-smartsheet",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "Instagantt",
      "plan": "Team",
      "price": 20,
      "unit": "Plano",
      "notes": "USD 240/ano, 3 colaboradores incluidos",
      "src": "wrike.com/blog/best-gantt-chart-software-online",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Planificación (Gantt)",
      "comp": "TeamGantt",
      "plan": "Lite",
      "price": 19,
      "unit": "Plano",
      "notes": "",
      "src": "spotsaas.com/compare/teamgantt-vs-wrike",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Notas de Equipo",
      "comp": "Notion",
      "plan": "Plus",
      "price": 10,
      "unit": "Por usuario",
      "notes": "",
      "src": "notion.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Notas de Equipo",
      "comp": "Notion",
      "plan": "Business",
      "price": 20,
      "unit": "Por usuario",
      "notes": "",
      "src": "notion.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Notas de Equipo",
      "comp": "Coda",
      "plan": "Pro",
      "price": 12,
      "unit": "Por usuario",
      "notes": "Solo Doc Makers pagan",
      "src": "vendr.com/marketplace/coda",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Notas de Equipo",
      "comp": "Coda",
      "plan": "Team",
      "price": 36,
      "unit": "Por usuario",
      "notes": "",
      "src": "vendr.com/marketplace/coda",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Notas de Equipo",
      "comp": "Slite",
      "plan": "Standard",
      "price": 8,
      "unit": "Por usuario",
      "notes": "",
      "src": "slite.com/learn/knowledge-base-softwares",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "HTML Panel / Dashboards",
      "comp": "Retool",
      "plan": "Team",
      "price": 10,
      "unit": "Por usuario",
      "notes": "Más USD 5 por usuario interno",
      "src": "jetadmin.io/blog/retool-pricing-explained-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "HTML Panel / Dashboards",
      "comp": "Retool",
      "plan": "Business",
      "price": 50,
      "unit": "Por usuario",
      "notes": "Más USD 15 por usuario interno",
      "src": "jetadmin.io/blog/retool-pricing-explained-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "HTML Panel / Dashboards",
      "comp": "Power BI",
      "plan": "Pro",
      "price": 14,
      "unit": "Por usuario",
      "notes": "",
      "src": "toucantoco.com/en/blog/power-bi-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "HTML Panel / Dashboards",
      "comp": "Power BI",
      "plan": "Premium por usuario",
      "price": 24,
      "unit": "Por usuario",
      "notes": "",
      "src": "toucantoco.com/en/blog/power-bi-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "HTML Panel / Dashboards",
      "comp": "Tableau",
      "plan": "Viewer",
      "price": 15,
      "unit": "Por usuario",
      "notes": "",
      "src": "costbench.com/software/business-intelligence/tableau",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "HTML Panel / Dashboards",
      "comp": "Tableau",
      "plan": "Creator",
      "price": 75,
      "unit": "Por usuario",
      "notes": "",
      "src": "costbench.com/software/business-intelligence/tableau",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "HTML Panel / Dashboards",
      "comp": "Geckoboard",
      "plan": "Essential",
      "price": 29,
      "unit": "Por usuario",
      "notes": "",
      "src": "itqlick.com/geckoboard/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "FossFLOW (BPM)",
      "comp": "Pipefy",
      "plan": "Business",
      "price": 18,
      "unit": "Por usuario",
      "notes": "Free hasta 10 usuarios y 5 procesos",
      "src": "aiproductivity.ai/blog/cflow-vs-kissflow-vs-pipefy",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "FossFLOW (BPM)",
      "comp": "Kissflow",
      "plan": "Por usuario",
      "price": 9.9,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "checkthat.ai/brands/kissflow/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "FossFLOW (BPM)",
      "comp": "Kissflow",
      "plan": "Basic (plataforma)",
      "price": 2500,
      "unit": "Plano",
      "notes": "Subio desde USD 1.500 en 2025",
      "src": "checkthat.ai/brands/kissflow/pricing",
      "conf": "Verificado",
      "ent": true
    },
    {
      "app": "FossFLOW (BPM)",
      "comp": "Nintex",
      "plan": "Standard",
      "price": 1405,
      "unit": "Plano",
      "notes": "",
      "src": "spotsaas.com/compare/kissflow-vs-nintex",
      "conf": "Verificado",
      "ent": true
    },
    {
      "app": "FossFLOW (BPM)",
      "comp": "Process Street",
      "plan": "Startup",
      "price": 100,
      "unit": "Plano",
      "notes": "",
      "src": "process.st/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "FossFLOW (BPM)",
      "comp": "monday.com",
      "plan": "Basic",
      "price": 9,
      "unit": "Por usuario",
      "notes": "Usado como plataforma de workflow",
      "src": "moxo.com/blog/best-business-process-management-software",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Digitai (automatización IA)",
      "comp": "Dify",
      "plan": "Professional",
      "price": 59,
      "unit": "Plano",
      "notes": "5.000 créditos de mensajes",
      "src": "checkthat.ai/brands/dify/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Digitai (automatización IA)",
      "comp": "Dify",
      "plan": "Team",
      "price": 159,
      "unit": "Plano",
      "notes": "10.000 créditos",
      "src": "checkthat.ai/brands/dify/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Digitai (automatización IA)",
      "comp": "Flowise",
      "plan": "Starter",
      "price": 35,
      "unit": "Plano",
      "notes": "Open source, self-host gratis",
      "src": "opentools.ai/tools/flowiseai",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Digitai (automatización IA)",
      "comp": "Flowise",
      "plan": "Enterprise",
      "price": 65,
      "unit": "Plano",
      "notes": "",
      "src": "opentools.ai/tools/flowiseai",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Digitai (automatización IA)",
      "comp": "n8n",
      "plan": "Starter",
      "price": 24,
      "unit": "Plano",
      "notes": "Self-host gratis",
      "src": "lindy.ai/blog/n8n-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Digitai (automatización IA)",
      "comp": "Relevance AI",
      "plan": "Team",
      "price": 199,
      "unit": "Plano",
      "notes": "",
      "src": "relevanceai.com/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Typeform",
      "plan": "Basic",
      "price": 29,
      "unit": "Plano",
      "notes": "100 respuestas/mes",
      "src": "stackcoast.com/typeform-vs-jotform-vs-tally",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Typeform",
      "plan": "Plus",
      "price": 59,
      "unit": "Plano",
      "notes": "1.000 respuestas/mes",
      "src": "stackcoast.com/typeform-vs-jotform-vs-tally",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Typeform",
      "plan": "Business",
      "price": 99,
      "unit": "Plano",
      "notes": "10.000 respuestas/mes",
      "src": "stackcoast.com/typeform-vs-jotform-vs-tally",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Jotform",
      "plan": "Bronze",
      "price": 24.99,
      "unit": "Plano",
      "notes": "1.000 respuestas/mes",
      "src": "stackcoast.com/typeform-vs-jotform-vs-tally",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Jotform",
      "plan": "Gold",
      "price": 129,
      "unit": "Plano",
      "notes": "10.000 respuestas/mes",
      "src": "stackcoast.com/typeform-vs-jotform-vs-tally",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Tally",
      "plan": "Pro",
      "price": 24,
      "unit": "Plano",
      "notes": "Pago anual; free con respuestas ilimitadas",
      "src": "formmate.app/blog/typeform-vs-tally",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Fillout",
      "plan": "Pro",
      "price": 40,
      "unit": "Plano",
      "notes": "Pago anual",
      "src": "customjs.space/blog/best-form-builders-automation-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Formularios de Contacto",
      "comp": "Fillout",
      "plan": "Business",
      "price": 75,
      "unit": "Plano",
      "notes": "Respuestas ilimitadas",
      "src": "customjs.space/blog/best-form-builders-automation-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Pipedrive",
      "plan": "Lite",
      "price": 14,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "pipedrive.com/en/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Pipedrive",
      "plan": "Growth",
      "price": 39,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "pipedrive.com/en/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Pipedrive",
      "plan": "Premium",
      "price": 59,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "pipedrive.com/en/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Pipedrive",
      "plan": "Ultimate",
      "price": 79,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "pipedrive.com/en/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "HubSpot Sales Hub",
      "plan": "Starter",
      "price": 15,
      "unit": "Por usuario",
      "notes": "USD 20 con pago mensual",
      "src": "docket.io/resources/research/hubspot-sales-hub-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "HubSpot Sales Hub",
      "plan": "Professional",
      "price": 90,
      "unit": "Por usuario",
      "notes": "Más USD 1.500 de onboarding",
      "src": "docket.io/resources/research/hubspot-sales-hub-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Apollo.io",
      "plan": "Basic",
      "price": 49,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "salesmotion.io/blog/apollo-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Apollo.io",
      "plan": "Organization",
      "price": 119,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "salesmotion.io/blog/apollo-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Lusha",
      "plan": "Starter",
      "price": 37.45,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "cognism.com/blog/apollo-io-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Salesforce",
      "plan": "Starter Suite",
      "price": 25,
      "unit": "Por usuario",
      "notes": "",
      "src": "salesforce.com/sales/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Salesforce",
      "plan": "Pro Suite",
      "price": 100,
      "unit": "Por usuario",
      "notes": "",
      "src": "salesforce.com/sales/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Prospección Comercial",
      "comp": "Salesforce",
      "plan": "Enterprise",
      "price": 175,
      "unit": "Por usuario",
      "notes": "Subio 6% en ago-2025",
      "src": "salesforce.com/sales/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Social Planner",
      "comp": "Buffer",
      "plan": "Essentials",
      "price": 5,
      "unit": "Por canal",
      "notes": "Pago anual",
      "src": "buffer.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Social Planner",
      "comp": "Buffer",
      "plan": "Team",
      "price": 10,
      "unit": "Por canal",
      "notes": "Pago anual",
      "src": "buffer.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Social Planner",
      "comp": "Hootsuite",
      "plan": "Standard",
      "price": 99,
      "unit": "Por usuario",
      "notes": "",
      "src": "superdirector.app/compare/sprout-social-vs-hootsuite-vs-later",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Social Planner",
      "comp": "Hootsuite",
      "plan": "Advanced",
      "price": 249,
      "unit": "Por usuario",
      "notes": "Rango 199-399",
      "src": "superdirector.app/compare/sprout-social-vs-hootsuite-vs-later",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Social Planner",
      "comp": "Metricool",
      "plan": "Starter",
      "price": 18,
      "unit": "Plano",
      "notes": "Pago anual; USD 22 mensual",
      "src": "checkthat.ai/brands/metricool/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Social Planner",
      "comp": "Later",
      "plan": "Starter",
      "price": 18.75,
      "unit": "Plano",
      "notes": "Pago anual",
      "src": "later.com/blog/social-media-scheduling-tools",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Social Planner",
      "comp": "Sprout Social",
      "plan": "Advanced",
      "price": 249,
      "unit": "Por usuario",
      "notes": "Pago anual",
      "src": "planifyapps.com/compare/metricool-vs-sprout-social",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kreative Studio",
      "comp": "Canva",
      "plan": "Teams",
      "price": 10,
      "unit": "Por usuario",
      "notes": "Pago anual, mínimo 3 asientos; USD 20 mensual",
      "src": "canvapricing.com",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kreative Studio",
      "comp": "Adobe Express",
      "plan": "Teams",
      "price": 7.99,
      "unit": "Por usuario",
      "notes": "USD 4,99 el primer ano",
      "src": "insidepro360.com/en/saas-tools/canva-vs-adobe-express-vs-figma",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kreative Studio",
      "comp": "Figma",
      "plan": "Professional",
      "price": 12,
      "unit": "Por usuario",
      "notes": "Rango 12-60 según tipo de asiento",
      "src": "match-vs.com/en/blog/best-design-tools",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kreative Studio",
      "comp": "VistaCreate",
      "plan": "Pro",
      "price": 13,
      "unit": "Por usuario",
      "notes": "",
      "src": "create.vista.com/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Kimos FunPlai (gamificación)",
      "comp": "Kahoot!",
      "plan": "Paid",
      "price": 29,
      "unit": "Plano",
      "notes": "Desde USD 10; free hasta 25 asistentes",
      "src": "saasworthy.com/product/kahoot/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kimos FunPlai (gamificación)",
      "comp": "Spinify",
      "plan": "Essentials",
      "price": 9,
      "unit": "Por usuario",
      "notes": "",
      "src": "capterra.com/p/155500/Spinify",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kimos FunPlai (gamificación)",
      "comp": "Spinify",
      "plan": "Plus",
      "price": 40,
      "unit": "Por usuario",
      "notes": "",
      "src": "capterra.com/p/155500/Spinify",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kimos FunPlai (gamificación)",
      "comp": "TalentLMS",
      "plan": "Core",
      "price": 119,
      "unit": "Plano",
      "notes": "Insignias, puntos y rankings",
      "src": "coursebox.ai/blog/gamified-learning-platforms",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Kimos FunPlai (gamificación)",
      "comp": "Mentimeter",
      "plan": "Pro",
      "price": 24.99,
      "unit": "Por usuario",
      "notes": "",
      "src": "mentimeter.com/plans",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Kimos FunPlai (gamificación)",
      "comp": "Gametize",
      "plan": "Business",
      "price": 50,
      "unit": "Plano",
      "notes": "",
      "src": "capterra.com/p/186453/Gametize",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "ProductLab",
      "comp": "Productboard",
      "plan": "Essentials",
      "price": 20,
      "unit": "Por usuario",
      "notes": "Por maker",
      "src": "blog.buildbetter.ai/best-ai-product-roadmap-tools",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "ProductLab",
      "comp": "Productboard",
      "plan": "Pro",
      "price": 80,
      "unit": "Por usuario",
      "notes": "Por maker",
      "src": "blog.buildbetter.ai/best-ai-product-roadmap-tools",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "ProductLab",
      "comp": "Aha!",
      "plan": "Discovery",
      "price": 39,
      "unit": "Por usuario",
      "notes": "",
      "src": "productlift.dev/blog/aha-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "ProductLab",
      "comp": "Aha!",
      "plan": "Roadmaps",
      "price": 59,
      "unit": "Por usuario",
      "notes": "",
      "src": "productlift.dev/blog/aha-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "ProductLab",
      "comp": "Airfocus",
      "plan": "Essential",
      "price": 19,
      "unit": "Por usuario",
      "notes": "",
      "src": "ideaplan.io/alternatives/airfocus",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "ProductLab",
      "comp": "Airfocus",
      "plan": "Advanced",
      "price": 69,
      "unit": "Por usuario",
      "notes": "",
      "src": "ideaplan.io/alternatives/airfocus",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "ProductLab",
      "comp": "Jira Product Discovery",
      "plan": "Standard",
      "price": 10,
      "unit": "Por usuario",
      "notes": "Solo creadores facturan",
      "src": "featurebase.app/blog/jira-product-discovery-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Productos (PIM)",
      "comp": "Plytix",
      "plan": "Pro",
      "price": 499,
      "unit": "Plano",
      "notes": "50.000 SKU, asientos ilimitados",
      "src": "plytix.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Productos (PIM)",
      "comp": "Plytix",
      "plan": "Brand Portals add-on",
      "price": 300,
      "unit": "Plano",
      "notes": "",
      "src": "plytix.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Productos (PIM)",
      "comp": "Akeneo",
      "plan": "Growth SaaS",
      "price": 3750,
      "unit": "Plano",
      "notes": "USD 45.000/ano",
      "src": "piminto.com/blog/akeneo-pricing",
      "conf": "Verificado",
      "ent": true
    },
    {
      "app": "Productos (PIM)",
      "comp": "Salsify",
      "plan": "Enterprise",
      "price": 6250,
      "unit": "Plano",
      "notes": "USD 75.000/ano piso",
      "src": "pimworks.io/blog/salsify-vs-akeneo",
      "conf": "Verificado",
      "ent": true
    },
    {
      "app": "Productos (PIM)",
      "comp": "Sales Layer",
      "plan": "Business",
      "price": 1000,
      "unit": "Plano",
      "notes": "",
      "src": "saleslayer.com/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Tienda (e-commerce)",
      "comp": "Shopify",
      "plan": "Basic",
      "price": 39,
      "unit": "Plano",
      "notes": "Más comisiones de pago",
      "src": "shopify.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Tienda (e-commerce)",
      "comp": "Shopify",
      "plan": "Grow",
      "price": 105,
      "unit": "Plano",
      "notes": "",
      "src": "shopify.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Tienda (e-commerce)",
      "comp": "Shopify",
      "plan": "Advanced",
      "price": 399,
      "unit": "Plano",
      "notes": "",
      "src": "shopify.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Tienda (e-commerce)",
      "comp": "BigCommerce",
      "plan": "Standard",
      "price": 39,
      "unit": "Plano",
      "notes": "Tope por volumen de ventas anual",
      "src": "getathenic.com/blog/best-ecommerce-platform-comparison-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Tienda (e-commerce)",
      "comp": "BigCommerce",
      "plan": "Plus",
      "price": 105,
      "unit": "Plano",
      "notes": "",
      "src": "getathenic.com/blog/best-ecommerce-platform-comparison-2026",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Tienda (e-commerce)",
      "comp": "Wix",
      "plan": "Core",
      "price": 17,
      "unit": "Plano",
      "notes": "Pago anual",
      "src": "websitebuilderexpert.com/ecommerce-website-builders/comparisons/wix-vs-shopify",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Tienda (e-commerce)",
      "comp": "Wix",
      "plan": "Business Elite",
      "price": 159,
      "unit": "Plano",
      "notes": "",
      "src": "websitebuilderexpert.com/ecommerce-website-builders/comparisons/wix-vs-shopify",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Vitrina (catálogo digital)",
      "comp": "Linktree",
      "plan": "Pro",
      "price": 9,
      "unit": "Plano",
      "notes": "",
      "src": "linktr.ee/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Vitrina (catálogo digital)",
      "comp": "Linktree",
      "plan": "Premium",
      "price": 24,
      "unit": "Plano",
      "notes": "",
      "src": "linktr.ee/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Vitrina (catálogo digital)",
      "comp": "Flipsnack",
      "plan": "Starter",
      "price": 14,
      "unit": "Plano",
      "notes": "",
      "src": "flipsnack.com/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Vitrina (catálogo digital)",
      "comp": "Flipsnack",
      "plan": "Professional",
      "price": 35,
      "unit": "Plano",
      "notes": "",
      "src": "flipsnack.com/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Vitrina (catálogo digital)",
      "comp": "Plytix",
      "plan": "Brand Portals",
      "price": 300,
      "unit": "Plano",
      "notes": "Add-on sobre plan PIM",
      "src": "plytix.com/pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "KIMOS Cashflow",
      "comp": "Float",
      "plan": "Essential",
      "price": 49,
      "unit": "Plano",
      "notes": "",
      "src": "spotsaas.com/compare/agicap-vs-moneto-vs-floatapp",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "KIMOS Cashflow",
      "comp": "Float",
      "plan": "Standard",
      "price": 99,
      "unit": "Plano",
      "notes": "",
      "src": "spotsaas.com/compare/agicap-vs-moneto-vs-floatapp",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "KIMOS Cashflow",
      "comp": "Float",
      "plan": "Premium",
      "price": 199,
      "unit": "Plano",
      "notes": "",
      "src": "spotsaas.com/compare/agicap-vs-moneto-vs-floatapp",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "KIMOS Cashflow",
      "comp": "Fathom",
      "plan": "Starter",
      "price": 50,
      "unit": "Plano",
      "notes": "Por módulo",
      "src": "capterra.com/p/136476/Fathom",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "KIMOS Cashflow",
      "comp": "Fathom",
      "plan": "Silver",
      "price": 260,
      "unit": "Plano",
      "notes": "",
      "src": "capterra.com/p/136476/Fathom",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "KIMOS Cashflow",
      "comp": "Agicap",
      "plan": "Business",
      "price": 180,
      "unit": "Plano",
      "notes": "Precio bajo cotización, no publicado",
      "src": "g2.com/products/agicap/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Gestión de Eventos",
      "comp": "Luma",
      "plan": "Plus",
      "price": 59,
      "unit": "Plano",
      "notes": "0% comisión; free con 5%",
      "src": "spotsaas.com/compare/luma-vs-eventbrite",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Gestión de Eventos",
      "comp": "Eventbrite",
      "plan": "Pro",
      "price": 15,
      "unit": "Plano",
      "notes": "Más 3,7% + USD 1,79 por ticket",
      "src": "stackscored.com/pricing/event-management",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Gestión de Eventos",
      "comp": "Bizzabo",
      "plan": "Event Experience OS",
      "price": 499,
      "unit": "Por usuario",
      "notes": "Mínimo 3 usuarios = USD 17.999/ano",
      "src": "stackscored.com/pricing/event-management",
      "conf": "Verificado",
      "ent": true
    },
    {
      "app": "Gestión de Eventos",
      "comp": "Dryfta",
      "plan": "Basic",
      "price": 99,
      "unit": "Plano",
      "notes": "",
      "src": "dryfta.com/pricing",
      "conf": "Estimado",
      "ent": false
    },
    {
      "app": "Gestión de Eventos",
      "comp": "Cvent",
      "plan": "Enterprise",
      "price": 4167,
      "unit": "Plano",
      "notes": "USD 50.000/ano piso estimado",
      "src": "stackscored.com/pricing/event-management",
      "conf": "Estimado",
      "ent": true
    },
    {
      "app": "Integraciones",
      "comp": "Zapier",
      "plan": "Professional",
      "price": 19.99,
      "unit": "Plano",
      "notes": "",
      "src": "lindy.ai/blog/zapier-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Integraciones",
      "comp": "Zapier",
      "plan": "Team",
      "price": 69,
      "unit": "Plano",
      "notes": "",
      "src": "lindy.ai/blog/zapier-pricing",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Integraciones",
      "comp": "Make",
      "plan": "Core",
      "price": 9,
      "unit": "Plano",
      "notes": "10.000 operaciones",
      "src": "automationatlas.io/guides/zapier-vs-make-n8n-comparison",
      "conf": "Verificado",
      "ent": false
    },
    {
      "app": "Integraciones",
      "comp": "n8n",
      "plan": "Starter",
      "price": 24,
      "unit": "Plano",
      "notes": "",
      "src": "lindy.ai/blog/n8n-pricing",
      "conf": "Verificado",
      "ent": false
    }
  ],
  "apps": [
    {
      "app": "Escritorio Kimos",
      "desc": "Control del escritorio, apertura de aplicaciones y chat entre agentes",
      "cat": "AI Workspace / agente de escritorio",
      "alts": "ChatGPT Business, Claude Team, M365 Copilot, Manus",
      "strat": "Ancla de la suite: incluir en todos los planes, nunca vender suelto",
      "pro": "Es el único módulo que ningún competidor replica dentro de una suite: los demás venden el asistente aparte de las apps. Orquestar agentes sobre datos propios elimina el copy-paste entre herramientas.",
      "con": "Compite contra OpenAI y Microsoft, que subsidian el precio. La calidad depende de modelos de terceros: si sube el costo del token, sube tu costo variable y no lo controlas.",
      "tgt": "Toda la base instalada",
      "icon": "monitor"
    },
    {
      "app": "Agentes",
      "desc": "Agentes IA internos que ejecutan tareas del negocio",
      "cat": "Constructor de agentes IA",
      "alts": "Zapier, Lindy, Relevance AI, Notion Agents",
      "strat": "Base fija baja + cobro por créditos de consumo",
      "pro": "Los agentes ya viven donde están los datos (CRM, archivos, productos). Zapier y Lindy tienen que conectarse por API a todo y pagan ese costo en latencia y fragilidad.",
      "con": "Categoría con el ciclo de innovación más rápido del mercado y jugadores con capital ilimitado. El costo por crédito es difícil de proyectar y erosiona margen si se subestima.",
      "tgt": "Equipos de operaciones",
      "icon": "bot"
    },
    {
      "app": "Agentes Web",
      "desc": "Chatbots y vendedores web (ej. vendedor_figit.ai)",
      "cat": "Chatbot / agente conversacional web",
      "alts": "Tidio, Intercom Fin, Chatbase, Crisp, ManyChat",
      "strat": "Módulo premium: alto valor percibido y ROI demostrable",
      "pro": "El bot conoce el catálogo real (módulo Productos) y el pipeline (Prospección), no un PDF cargado a mano. Ese contexto es exactamente lo que Chatbase no puede dar.",
      "con": "Intercom domina el segmento medio-alto con una marca enorme y Tidio el bajo con precio agresivo. Sin volumen de conversaciones, el modelo por resolución de Intercom sale más barato.",
      "tgt": "E-commerce y equipos de soporte",
      "icon": "message"
    },
    {
      "app": "Archivos",
      "desc": "Gestor documental de la organización",
      "cat": "Almacenamiento y gestión documental",
      "alts": "Google Workspace, Dropbox Business, Box, Egnyte",
      "strat": "Commodity: incluir en el core, jamás vender suelto",
      "pro": "Los archivos quedan junto a las tareas, productos y clientes que los originan, sin una capa de integración de por medio.",
      "con": "Es la categoría más comoditizada que existe y compite contra almacenamiento a escala de Google. Nadie cambia de proveedor de archivos por si solo: solo migra si migra todo.",
      "tgt": "Toda la base instalada",
      "icon": "folder"
    },
    {
      "app": "Conocimiento",
      "desc": "Base de conocimiento corporativa",
      "cat": "Knowledge base / wiki con IA",
      "alts": "Confluence, Guru, Slite, Notion, Document360",
      "strat": "Incluir en el core; diferenciar con búsqueda IA nativa",
      "pro": "La búsqueda alimenta directamente a los agentes: el conocimiento no es un repositorio muerto sino el contexto que consume el resto de la suite.",
      "con": "Notion y Confluence tienen ecosistemas de plantillas y comunidades que tomaron una década construir. Migrar documentación es doloroso y frena la venta.",
      "tgt": "Equipos de 10+ personas",
      "icon": "book"
    },
    {
      "app": "Equipos",
      "desc": "Colaboración y comunicación por equipo",
      "cat": "Colaboración / chat de equipo",
      "alts": "Slack, Microsoft Teams, Google Chat",
      "strat": "Commodity: incluir en el core",
      "pro": "Conversación pegada al trabajo, sin saltar entre Slack y el gestor de tareas.",
      "con": "Es la categoría más difícil de desplazar del mercado: el chat tiene efecto de red y Teams viene gratis con Microsoft 365. Recomendación honesta: no pelear aquí, integrarse.",
      "tgt": "Toda la base instalada",
      "icon": "users"
    },
    {
      "app": "Kanban",
      "desc": "Tableros de tareas y flujos de trabajo",
      "cat": "Gestión de tareas Kanban",
      "alts": "Trello, ClickUp, Monday.com, Asana, Jira",
      "strat": "Módulo de entrada con precio agresivo: sirve para adquirir, no para monetizar",
      "pro": "Funcionalidad de paridad razonable y es el módulo más fácil de adoptar sin capacitacion. Buen caballo de Troya para entrar a la cuenta.",
      "con": "Mercado saturado con Trello a USD 5 y ClickUp a USD 7. Cero disposición a pagar más que el líder, y el costo de cambio para el cliente es bajísimo.",
      "tgt": "Todos los equipos",
      "icon": "columns"
    },
    {
      "app": "Planificación (Gantt)",
      "desc": "Planificación de proyectos en diagrama de Gantt",
      "cat": "Planificación de proyectos / Gantt",
      "alts": "Smartsheet, Wrike, MS Project, TeamGantt, Instagantt",
      "strat": "Vender empaquetado con Kanban como módulo único de gestión de proyectos",
      "pro": "Vendido junto a Kanban da una propuesta que Trello no tiene y Smartsheet cobra a USD 19.",
      "con": "MS Project es el estándar de facto en organizaciones grandes por inercia. Gantt suelto es un producto de nicho: casi nadie lo compra aislado.",
      "tgt": "PMOs y consultoras",
      "icon": "calendar"
    },
    {
      "app": "Notas de Equipo",
      "desc": "Notas colaborativas y seguimiento de modificaciones",
      "cat": "Notas colaborativas / docs",
      "alts": "Notion, Coda, Evernote Teams, Slite",
      "strat": "Incluir en el core",
      "pro": "Las notas se vinculan a tareas y clientes reales en vez de vivir en un documento aislado.",
      "con": "Notion define la categoría y tiene una comunidad gigantesca de plantillas. Competir de frente en features de documento es una batalla pérdida.",
      "tgt": "Toda la base instalada",
      "icon": "note"
    },
    {
      "app": "HTML Panel / Dashboards",
      "desc": "Paneles HTML personalizados (BSC, análisis estratégico)",
      "cat": "Dashboards y paneles embebidos",
      "alts": "Retool, Power BI, Tableau, Geckoboard",
      "strat": "Diferenciador técnico: módulo premium con servicios de implementación",
      "pro": "Los datos ya están dentro de la suite: no hay ETL ni conectores que mantener. Power BI necesita una capa de integración completa para llegar a lo mismo.",
      "con": "Power BI a USD 14 con el peso de Microsoft detras es difícil de superar en percepción. Requiere perfiles técnicos para armar los paneles y eso encarece el onboarding.",
      "tgt": "Gerencia y dirección",
      "icon": "chart"
    },
    {
      "app": "FossFLOW (BPM)",
      "desc": "Gestión y automatización de procesos de negocio, con supervision por etapa",
      "cat": "BPM / automatización de procesos",
      "alts": "Pipefy, Kissflow, Nintex, Process Street, monday.com",
      "strat": "Módulo premium: es donde el ticket sube sin resistencia",
      "pro": "Categoría con precios altos y competidores caros o pesados: Kissflow parte en USD 2.500/mes de plataforma y Nintex en USD 1.405. Hay mucho espacio para entrar por debajo con algo usable.",
      "con": "Es el módulo más difícil de construir bien: motor de reglas, versionado, auditoría y cumplimiento. Vender BPM exige consultoria y ciclos de venta largos.",
      "tgt": "Empresas con procesos regulados",
      "icon": "flow"
    },
    {
      "app": "Digitai (automatización IA)",
      "desc": "Gestión y automatización de tareas de IA y procesamiento de datos",
      "cat": "Automatización IA / orquestación de datos",
      "alts": "Dify, Flowise, n8n, Relevance AI",
      "strat": "Cobro por consumo; evaluar fusionarlo con Agentes",
      "pro": "Complementa a los Agentes con el pipeline de datos que los alimenta. Precios de referencia razonables (Dify USD 59, n8n USD 24) dejan margen.",
      "con": "Se solapa fuerte con el módulo Agentes: dos productos que el cliente percibe como uno. Además compite contra open source gratuito y autohospedable, que es un techo de precio duro.",
      "tgt": "Equipos técnicos",
      "icon": "cpu"
    },
    {
      "app": "Formularios de Contacto",
      "desc": "Administración de formularios de contacto",
      "cat": "Formularios y captura de leads",
      "alts": "Typeform, Jotform, Tally, Fillout",
      "strat": "Gancho de entrada freemium con límite de respuestas",
      "pro": "El lead entra directo al CRM sin Zapier de por medio. Typeform cobra USD 29 solo por 100 respuestas al mes.",
      "con": "Tally regala respuestas ilimitadas en su plan free: el piso de precio de la categoría tiende a cero. No es un módulo del que se pueda vivir.",
      "tgt": "Marketing y ventas",
      "icon": "form"
    },
    {
      "app": "Prospección Comercial",
      "desc": "Gestión y seguimiento de prospección de clientes",
      "cat": "CRM / prospección de ventas",
      "alts": "Pipedrive, HubSpot, Apollo.io, Salesforce",
      "strat": "El módulo con mayor disposición a pagar de toda la suite",
      "pro": "Es donde el cliente ya acepta pagar USD 39-100 por asiento. Integrado con Agentes Web y Formularios cierra el ciclo completo de lead a venta, algo que Pipedrive solo hace comprando add-ons.",
      "con": "Categoría con costo de cambio altísimo: nadie migra su CRM a la ligera. Salesforce y HubSpot tienen ecosistemas de partners que KIMOS no puede igualar en el corto plazo.",
      "tgt": "Equipos comerciales",
      "icon": "target"
    },
    {
      "app": "Social Planner",
      "desc": "Planificación de contenido en redes sociales",
      "cat": "Gestión y programación de redes",
      "alts": "Buffer, Hootsuite, Metricool, Later, Sprout Social",
      "strat": "Cobrar por canal conectado, nunca por usuario",
      "pro": "Junto a Kreative Studio cubre crear y publicar en un solo lugar; Buffer y Hootsuite solo publican.",
      "con": "Depende de APIs de terceros (Meta, TikTok, LinkedIn) que cambian sin aviso y obligan a mantenimiento constante. Metricool a USD 18 fija un techo bajo.",
      "tgt": "Marketing y agencias",
      "icon": "share"
    },
    {
      "app": "Kreative Studio",
      "desc": "Creación de contenido visual: posts, banners, logos y material gráfico",
      "cat": "Diseño gráfico / contenido visual",
      "alts": "Canva, Adobe Express, Figma, VistaCreate",
      "strat": "Vender junto a Social Planner como paquete de marketing",
      "pro": "El diseño conectado al catálogo de productos y al calendario de publicación es un flujo que Canva no tiene cerrado.",
      "con": "Canva tiene 200+ millones de usuarios, una biblioteca de plantillas imposible de replicar y cobra USD 10. Competir en features de diseño puro no es realista.",
      "tgt": "Marketing y diseñadores",
      "icon": "palette"
    },
    {
      "app": "Kimos FunPlai (gamificación)",
      "desc": "Gamificación y experiencias interactivas: juegos, concursos y actividades lúdicas",
      "cat": "Gamificación y engagement",
      "alts": "Kahoot!, Spinify, Mentimeter, TalentLMS, Gametize",
      "strat": "Add-on por campaña o por evento, no suscripción mensual fija",
      "pro": "Categoría fragmentada y sin líder claro en el mundo hispano. Conectado a Equipos y Eventos permite gamificar procesos internos reales, no solo trivias sueltas.",
      "con": "Uso episódico: la gente lo usa para una campaña y lo abandona, lo que produce churn alto si se cobra mensual. Kahoot domina el reconocimiento de marca en lo educativo.",
      "tgt": "RRHH, marketing y eventos",
      "icon": "game"
    },
    {
      "app": "ProductLab",
      "desc": "Gestión de producto, investigación y desarrollo",
      "cat": "Product management / roadmap",
      "alts": "Productboard, Aha!, Airfocus, Jira Product Discovery",
      "strat": "Nicho de ticket alto: pocos asientos, precio elevado por asiento",
      "pro": "Precios de referencia altos (Productboard Pro USD 80, Aha! USD 59) y competidores percibidos como caros y complejos.",
      "con": "Nicho estrecho: solo lo compran empresas con equipo de producto formal. En Latinoamérica ese perfil es escaso y alarga el ciclo de venta.",
      "tgt": "Empresas con equipo de producto",
      "icon": "flask"
    },
    {
      "app": "Productos (PIM)",
      "desc": "Gestión de catálogos de productos",
      "cat": "PIM / catálogo de productos",
      "alts": "Plytix, Akeneo, Salsify, Sales Layer",
      "strat": "Tarifa plana por volumen de SKU con asientos ilimitados",
      "pro": "La brecha de precio es enorme: Plytix cobra USD 499 y Akeneo parte en USD 45.000 al ano. Integrado con Tienda y Vitrina, KIMOS cubre el ciclo entero que Plytix vende como add-ons de USD 300 cada uno.",
      "con": "PIM es intensivo en calidad de datos y migración: el proyecto se juega en la implementación, no en el software. Exige un equipo de soporte técnico sólido.",
      "tgt": "Retail, distribución y manufactura",
      "icon": "box"
    },
    {
      "app": "Tienda (e-commerce)",
      "desc": "Tienda en línea",
      "cat": "E-commerce / storefront",
      "alts": "Shopify, BigCommerce, Wix, WooCommerce",
      "strat": "Tarifa plana; evaluar comisión sobre GMV solo en tiers bajos",
      "pro": "Con PIM y Vitrina integrados, la tienda se alimenta sola desde el catálogo maestro.",
      "con": "Shopify es un monopolio blando con un app store de miles de integraciones. Sin ese ecosistema, la tienda de KIMOS será funcionalmente más pobre por varios años. Recomendación honesta: integrarse con Shopify antes que competirle.",
      "tgt": "Retail y PyMEs con venta online",
      "icon": "cart"
    },
    {
      "app": "Vitrina (catálogo digital)",
      "desc": "Vitrina publica de productos y marca",
      "cat": "Catálogo digital / brand portal",
      "alts": "Linktree, Flipsnack, Plytix Brand Portals",
      "strat": "Add-on económico sobre Productos o Tienda",
      "pro": "Plytix cobra USD 300 por el mismo add-on. Como complemento del PIM es margen casi puro.",
      "con": "Es una feature, no un producto: nadie contrata una suite por su vitrina. Vendida suelta compite con Linktree a USD 9.",
      "tgt": "Retail y marcas",
      "icon": "store"
    },
    {
      "app": "KIMOS Cashflow",
      "desc": "Gestión del flujo de caja",
      "cat": "Gestión y proyección de flujo de caja",
      "alts": "Float, Fathom, Agicap, Dryrun",
      "strat": "Tarifa plana por empresa, nunca por usuario",
      "pro": "Categoría con precios sanos (Float USD 49-199, Fathom hasta USD 260) y competidores extranjeros con poca adaptación tributaria local.",
      "con": "Exige integración con bancos y ERPs locales para ser útil de verdad, y eso es trabajo país por país. Sin conciliacion automática queda en una planilla bonita.",
      "tgt": "Gerencia financiera y PyMEs",
      "icon": "coins"
    },
    {
      "app": "Gestión de Eventos",
      "desc": "Gestión de eventos corporativos (Desayuno Ciberseguridad 2026)",
      "cat": "Gestión de eventos",
      "alts": "Luma, Eventbrite, Bizzabo, Cvent",
      "strat": "Cobrar por evento o campaña, no como suscripción mensual",
      "pro": "El evento se conecta al CRM y a los formularios: los asistentes se vuelven leads automáticamente. Bizzabo cobra USD 499 por usuario para hacer eso mismo.",
      "con": "Uso estacional con churn natural. Luma es gratis y muy bueno para eventos chicos, lo que aplasta el precio en el segmento de entrada.",
      "tgt": "Marketing corporativo",
      "icon": "ticket"
    },
    {
      "app": "Integraciones",
      "desc": "Conexión con sistemas externos",
      "cat": "iPaaS / automatización",
      "alts": "Zapier, Make, n8n",
      "strat": "Incluir en el core y cobrar por volumen de ejecuciones",
      "pro": "Al vivir dentro de la suite evita el costo de conectar cada app entre si, que es justamente el problema que Zapier existe para resolver.",
      "con": "Make cobra USD 9 por 10.000 operaciones y n8n es gratis autohospedado. El techo de precio es muy bajo y el valor solo aparece hacia afuera de la suite.",
      "tgt": "Toda la base instalada",
      "icon": "plug"
    }
  ],
  "planes": [
    {
      "name": "Core",
      "mods": [
        "Escritorio Kimos",
        "Archivos",
        "Notas de Equipo",
        "Equipos",
        "Conocimiento",
        "Integraciones"
      ],
      "desc": "Plataforma base: escritorio con agentes, archivos, notas, equipos, conocimiento e integraciones",
      "disc": 0.55,
      "tgt": "Empresas que entran a probar la suite"
    },
    {
      "name": "Starter",
      "mods": [
        "Escritorio Kimos",
        "Archivos",
        "Notas de Equipo",
        "Equipos",
        "Conocimiento",
        "Integraciones",
        "Kanban",
        "Formularios de Contacto"
      ],
      "desc": "Core + gestión de tareas + captura de leads",
      "disc": 0.55,
      "tgt": "PyMEs de 5 a 20 personas sin procesos formales"
    },
    {
      "name": "Business",
      "mods": [
        "Escritorio Kimos",
        "Archivos",
        "Notas de Equipo",
        "Equipos",
        "Conocimiento",
        "Integraciones",
        "Kanban",
        "Formularios de Contacto",
        "Planificación (Gantt)",
        "Prospección Comercial",
        "Social Planner",
        "Kreative Studio",
        "HTML Panel / Dashboards",
        "Agentes"
      ],
      "desc": "Core + proyectos + CRM + marketing + dashboards + agentes IA",
      "disc": 0.6,
      "tgt": "Empresas de 20 a 100 personas con equipo comercial"
    },
    {
      "name": "Enterprise",
      "mods": null,
      "desc": "Todos los módulos, incluidos BPM, PIM, Tienda, Cashflow, ProductLab, Eventos y Agentes Web",
      "disc": 0.62,
      "tgt": "Empresas de 100+ personas o con procesos regulados"
    }
  ],
  "kits": [
    {
      "name": "Kit Comercial",
      "mods": [
        "Prospección Comercial",
        "Formularios de Contacto",
        "Agentes Web",
        "Social Planner",
        "Kreative Studio"
      ],
      "desc": "Captar, atender y cerrar: CRM + formularios + chatbot + redes + diseño",
      "disc": 0.45,
      "tgt": "Equipos de ventas y marketing"
    },
    {
      "name": "Kit Operaciones",
      "mods": [
        "Kanban",
        "Planificación (Gantt)",
        "FossFLOW (BPM)",
        "HTML Panel / Dashboards",
        "Notas de Equipo"
      ],
      "desc": "Ejecutar y controlar: tareas + Gantt + procesos + paneles",
      "disc": 0.45,
      "tgt": "PMOs, operaciones y consultoras"
    },
    {
      "name": "Kit Retail",
      "mods": [
        "Productos (PIM)",
        "Tienda (e-commerce)",
        "Vitrina (catálogo digital)",
        "Agentes Web",
        "Kreative Studio"
      ],
      "desc": "Vender en línea: catálogo maestro + tienda + vitrina + bot + diseño",
      "disc": 0.45,
      "tgt": "Retail, distribución y marcas"
    },
    {
      "name": "Kit IA",
      "mods": [
        "Escritorio Kimos",
        "Agentes",
        "Digitai (automatización IA)",
        "Agentes Web",
        "Conocimiento"
      ],
      "desc": "Automatizar con IA: escritorio + agentes + pipelines de datos + bot + base de conocimiento",
      "disc": 0.45,
      "tgt": "Equipos técnicos y de innovación"
    },
    {
      "name": "Kit Finanzas y Gestión",
      "mods": [
        "KIMOS Cashflow",
        "HTML Panel / Dashboards",
        "Planificación (Gantt)",
        "Archivos"
      ],
      "desc": "Controlar la plata: flujo de caja + paneles + planificación + documentos",
      "disc": 0.45,
      "tgt": "Gerencia financiera"
    }
  ],
  "stack": [
    {
      "need": "Archivos, correo y videollamadas",
      "app": "Archivos",
      "comp": "Google Workspace",
      "plan": "Business Standard"
    },
    {
      "need": "Chat de equipo",
      "app": "Equipos",
      "comp": "Slack",
      "plan": "Pro"
    },
    {
      "need": "Tareas y proyectos",
      "app": "Kanban",
      "comp": "ClickUp",
      "plan": "Business"
    },
    {
      "need": "Planificación Gantt",
      "app": "Planificación (Gantt)",
      "comp": "Smartsheet",
      "plan": "Pro"
    },
    {
      "need": "Base de conocimiento",
      "app": "Conocimiento",
      "comp": "Confluence",
      "plan": "Standard"
    },
    {
      "need": "Notas colaborativas",
      "app": "Notas de Equipo",
      "comp": "Notion",
      "plan": "Plus"
    },
    {
      "need": "CRM y prospección",
      "app": "Prospección Comercial",
      "comp": "Pipedrive",
      "plan": "Growth"
    },
    {
      "need": "Redes sociales",
      "app": "Social Planner",
      "comp": "Buffer",
      "plan": "Team"
    },
    {
      "need": "Formularios",
      "app": "Formularios de Contacto",
      "comp": "Typeform",
      "plan": "Basic"
    },
    {
      "need": "Diseño gráfico",
      "app": "Kreative Studio",
      "comp": "Canva",
      "plan": "Teams"
    },
    {
      "need": "Chatbot web",
      "app": "Agentes Web",
      "comp": "Tidio",
      "plan": "Growth"
    },
    {
      "need": "Flujo de caja",
      "app": "KIMOS Cashflow",
      "comp": "Float",
      "plan": "Standard"
    },
    {
      "need": "Dashboards",
      "app": "HTML Panel / Dashboards",
      "comp": "Power BI",
      "plan": "Pro"
    },
    {
      "need": "Automatización de procesos",
      "app": "FossFLOW (BPM)",
      "comp": "Pipefy",
      "plan": "Business"
    },
    {
      "need": "Automatización IA",
      "app": "Digitai (automatización IA)",
      "comp": "Dify",
      "plan": "Professional"
    },
    {
      "need": "Gamificación",
      "app": "Kimos FunPlai (gamificación)",
      "comp": "Kahoot!",
      "plan": "Paid"
    },
    {
      "need": "Gestión de producto",
      "app": "ProductLab",
      "comp": "Jira Product Discovery",
      "plan": "Standard"
    },
    {
      "need": "PIM / catálogo",
      "app": "Productos (PIM)",
      "comp": "Plytix",
      "plan": "Pro"
    },
    {
      "need": "Tienda online",
      "app": "Tienda (e-commerce)",
      "comp": "Shopify",
      "plan": "Grow"
    },
    {
      "need": "Vitrina de marca",
      "app": "Vitrina (catálogo digital)",
      "comp": "Linktree",
      "plan": "Premium"
    },
    {
      "need": "Asistente IA",
      "app": "Escritorio Kimos",
      "comp": "ChatGPT Business",
      "plan": "Business"
    },
    {
      "need": "Agentes / automatización",
      "app": "Agentes",
      "comp": "Zapier",
      "plan": "Team"
    },
    {
      "need": "Integraciones",
      "app": "Integraciones",
      "comp": "Make",
      "plan": "Core"
    },
    {
      "need": "Eventos",
      "app": "Gestión de Eventos",
      "comp": "Luma",
      "plan": "Plus"
    }
  ],
  "core_plat": [
    "Apariencia",
    "Configuración",
    "Seguridad",
    "Usuarios"
  ]
};

/* ── Iconografía (Lucide, embebida: la app carga sin red) ─────────────── */

const ICONOS = {
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  bot: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
  columns: '<rect x="3" y="3" width="6" height="18" rx="1"/><rect x="15" y="3" width="6" height="12" rx="1"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  flow: '<rect x="2" y="3" width="7" height="6" rx="1"/><rect x="15" y="15" width="7" height="6" rx="1"/><path d="M5.5 9v5a4 4 0 0 0 4 4h5.5"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  form: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 12h8M8 17h4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 1 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.6-.4-1 0-.9.7-1.6 1.6-1.6H16a6 6 0 0 0 6-6c0-4.9-4.5-8.7-10-8.7z"/>',
  game: '<path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/><rect x="2" y="6" width="20" height="12" rx="5"/>',
  flask: '<path d="M9 2v6.5L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19l-5-10.5V2"/><path d="M8 2h8M7 15h10"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  store: '<path d="M3 9l1.5-5h15L21 9M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4a6 6 0 1 1-7.7 7.7"/><path d="M7 6h2v4M9.5 14H7"/>',
  ticket: '<path d="M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v14"/>',
  plug: '<path d="M12 22v-5M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M6 7l-3 7h6zM18 7l-3 7h6z"/>',
};

const ICO_TAB = {
  resumen: 'chart', mapa: 'grid', precios: 'coins', planes: 'box',
  configurador: 'sliders', versus: 'scale', diagnostico: 'target',
};

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'mapa', label: 'Mapa competitivo' },
  { id: 'precios', label: 'Precios por app' },
  { id: 'planes', label: 'Planes y kits' },
  { id: 'configurador', label: 'Configurador' },
  { id: 'versus', label: 'Pros y contras' },
  { id: 'diagnostico', label: 'Diagnóstico' },
];

/* Puntajes del diagnóstico: valor por defecto y por qué. El usuario los edita. */
const PUNTAJES = [
  { id: 'amplitud', lb: 'Amplitud funcional de la suite', v: 9,
    help: '24 módulos, de CRM a PIM. Ningún competidor de este tamaño ofrece tanto bajo un mismo login.' },
  { id: 'integracion', lb: 'Integración entre módulos', v: 8,
    help: 'Es la ventaja real y la única defendible: el dato fluye sin conectores. Todo el pricing debe apoyarse aquí.' },
  { id: 'ia', lb: 'Capa de IA y agentes', v: 8,
    help: 'Escritorio con agentes, chatbots web y automatización de datos ya integrados. La competencia vende el asistente aparte.' },
  { id: 'profundidad', lb: 'Profundidad por módulo', v: 4,
    help: 'Aquí está la debilidad. Contra Shopify, Notion, Canva o Salesforce cada módulo individual es más pobre. Es el precio inevitable de la amplitud.' },
  { id: 'ecosistema', lb: 'Ecosistema y comunidad', v: 3,
    help: 'Sin app store, sin partners, sin plantillas de comunidad. Shopify y Notion construyeron eso en una década.' },
  { id: 'precio', lb: 'Posición de precio', v: 8,
    help: 'Entrar en torno al 28% del gasto actual del cliente con ahorro demostrable es una posición comercial sólida.' },
  { id: 'soporte', lb: 'Escalabilidad del soporte', v: 4,
    help: '24 módulos son 24 frentes de soporte, documentación y roadmap. Es el mayor riesgo operativo del modelo.' },
  { id: 'defensa', lb: 'Defensa ante los grandes', v: 5,
    help: 'Microsoft y Google regalan piezas del stack. La defensa no es funcional: es el costo de cambio de tenerlo todo integrado.' },
];

const UNIDADES = ['Por usuario', 'Por canal', 'Plano'];
const CONFIANZAS = ['Verificado', 'Estimado - verificar'];
const BANDA = { min: 0.25, max: 0.6 }; // % del gasto actual del cliente donde el precio es sano

const CONFIG_DEF = { acento: '', mostrarFuentes: true, densidad: 'normal' };

/* ── Utilidades ───────────────────────────────────────────────────────── */

const nombreCorto = (s) => String(s || '').split(' (')[0];
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const money1 = (n) => '$' + (Math.round((Number(n) || 0) * 10) / 10)
  .toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n) => Math.round((Number(n) || 0) * 100) + '%';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const numero = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);

function mediana(arr) {
  if (!arr.length) return 0;
  const b = arr.slice().sort((x, y) => x - y);
  const i = b.length >> 1;
  return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2;
}

const nuevoId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ── Modelo ───────────────────────────────────────────────────────────── */

const APPS_VALIDAS = new Set(DATOS.apps.map((a) => a.app));
const PRESETS = () => DATOS.planes.concat(DATOS.kits);

function filaLimpia(d, id) {
  return {
    id: id || String(d.id || nuevoId()),
    app: APPS_VALIDAS.has(d.app) ? d.app : DATOS.apps[0].app,
    comp: String(d.comp || '').slice(0, 80) || 'Sin nombre',
    plan: String(d.plan || '').slice(0, 60),
    price: Math.max(0, numero(d.price, 0)),
    unit: UNIDADES.indexOf(d.unit) >= 0 ? d.unit : 'Plano',
    notes: String(d.notes || '').slice(0, 300),
    src: String(d.src || '').slice(0, 200),
    conf: d.conf === 'Verificado' ? 'Verificado' : 'Estimado - verificar',
    ent: !!d.ent,
  };
}

function modeloBase() {
  const disc = {};
  PRESETS().forEach((p) => { disc[p.name] = p.disc; });
  const puntajes = {};
  PUNTAJES.forEach((p) => { puntajes[p.id] = p.v; });
  const business = DATOS.planes.find((p) => p.name === 'Business') || DATOS.planes[0];
  return {
    tab: 'resumen',
    sup: {
      usuarios: DATOS.sup.usuarios,
      canales: DATOS.sup.canales,
      factor: DATOS.sup.factor,
      anual: DATOS.sup.desc_anual,
    },
    det: DATOS.det.map((d, i) => filaLimpia(d, 'd' + i)),
    disc,
    mods: {},        // composición de planes/kits editada por el usuario
    ovr: {},         // precio sugerido fijado a mano por módulo
    txt: {},         // pros / contras / estrategia editados por módulo
    sel: (business.mods || []).slice(),
    cfgDisc: disc[business.name],
    puntajes,
    notas: '',
    filtro: '',   // estado de vista: filtro de la tabla de competencia
    panel: '',    // estado de vista: qué plan tiene abierto su editor de módulos
  };
}

function normalizar(data) {
  const base = modeloBase();
  if (!data || typeof data !== 'object') return base;
  const m = Object.assign({}, base, data);

  m.tab = TABS.some((t) => t.id === data.tab) ? data.tab : 'resumen';
  const sup = data.sup && typeof data.sup === 'object' ? data.sup : {};
  m.sup = {
    usuarios: clamp(Math.round(numero(sup.usuarios, base.sup.usuarios)), 1, 5000),
    canales: clamp(Math.round(numero(sup.canales, base.sup.canales)), 1, 200),
    factor: clamp(numero(sup.factor, base.sup.factor), 0.1, 2),
    anual: clamp(numero(sup.anual, base.sup.anual), 0, 0.6),
  };

  m.det = Array.isArray(data.det) && data.det.length
    ? data.det.map((d) => filaLimpia(d)).filter((d) => d.comp)
    : base.det;

  m.disc = Object.assign({}, base.disc);
  if (data.disc && typeof data.disc === 'object') {
    Object.keys(data.disc).forEach((k) => {
      if (k in m.disc) m.disc[k] = clamp(numero(data.disc[k], m.disc[k]), 0, 0.95);
    });
  }

  m.mods = {};
  if (data.mods && typeof data.mods === 'object') {
    PRESETS().forEach((p) => {
      const lista = data.mods[p.name];
      if (Array.isArray(lista)) m.mods[p.name] = lista.filter((x) => APPS_VALIDAS.has(x));
    });
  }

  m.ovr = {};
  if (data.ovr && typeof data.ovr === 'object') {
    Object.keys(data.ovr).forEach((k) => {
      if (APPS_VALIDAS.has(k) && Number.isFinite(Number(data.ovr[k]))) {
        m.ovr[k] = Math.max(0, Math.round(Number(data.ovr[k])));
      }
    });
  }

  m.txt = {};
  if (data.txt && typeof data.txt === 'object') {
    Object.keys(data.txt).forEach((k) => {
      if (!APPS_VALIDAS.has(k) || !data.txt[k]) return;
      const t = {};
      ['pro', 'con', 'strat'].forEach((campo) => {
        if (typeof data.txt[k][campo] === 'string') t[campo] = data.txt[k][campo].slice(0, 2000);
      });
      if (Object.keys(t).length) m.txt[k] = t;
    });
  }

  m.sel = Array.isArray(data.sel) ? data.sel.filter((x) => APPS_VALIDAS.has(x)) : base.sel;
  m.cfgDisc = clamp(numero(data.cfgDisc, base.cfgDisc), 0, 0.95);

  m.puntajes = Object.assign({}, base.puntajes);
  if (data.puntajes && typeof data.puntajes === 'object') {
    PUNTAJES.forEach((p) => {
      if (p.id in data.puntajes) {
        m.puntajes[p.id] = clamp(Math.round(numero(data.puntajes[p.id], p.v)), 0, 10);
      }
    });
  }

  m.notas = String(data.notas == null ? '' : data.notas).slice(0, 8000);
  m.filtro = String(data.filtro == null ? '' : data.filtro).slice(0, 120);
  m.panel = PRESETS().some((p) => p.name === data.panel) ? data.panel : '';
  return m;
}

/* ── Cálculo del modelo de precios ────────────────────────────────────── */

function calcular(m) {
  const factorUnidad = (u) => (u === 'Por usuario' ? m.sup.usuarios : (u === 'Por canal' ? m.sup.canales : 1));

  const porApp = {};
  DATOS.apps.forEach((a) => {
    const filas = m.det.filter((d) => d.app === a.app);
    const todas = filas.map((d) => d.price * factorUnidad(d.unit));
    const pyme = filas.filter((d) => !d.ent).map((d) => d.price * factorUnidad(d.unit));
    // Sin planes PyME en la categoría, se cae a todas: mejor una referencia
    // sesgada y avisada que ninguna.
    const bases = pyme.length ? pyme : todas;
    const med = mediana(bases);
    const calc = Math.round(med * m.sup.factor);
    const ovr = Number.isFinite(m.ovr[a.app]) ? Math.round(m.ovr[a.app]) : null;
    const sug = ovr == null ? calc : ovr;
    porApp[a.app] = {
      min: bases.length ? Math.min.apply(null, bases) : 0,
      max: todas.length ? Math.max.apply(null, todas) : 0,
      med,
      calc,
      ovr,
      sug,
      peruser: sug / m.sup.usuarios,
      n: filas.length,
      ver: filas.filter((d) => d.conf === 'Verificado').length,
      soloEnt: !pyme.length && todas.length > 0,
    };
  });

  const stack = DATOS.stack.map((s) => {
    const fila = m.det.find((d) => d.app === s.app && d.comp === s.comp && d.plan === s.plan)
      || m.det.find((d) => d.app === s.app && d.comp === s.comp);
    return Object.assign({}, s, { cost: fila ? fila.price * factorUnidad(fila.unit) : 0 });
  });

  return {
    porApp,
    factorUnidad,
    total: DATOS.apps.reduce((s, a) => s + porApp[a.app].sug, 0),
    totalMed: DATOS.apps.reduce((s, a) => s + porApp[a.app].med, 0),
    stack,
    stackTotal: stack.reduce((s, x) => s + x.cost, 0),
    nDet: m.det.length,
    nVer: m.det.filter((d) => d.conf === 'Verificado').length,
    nEnt: m.det.filter((d) => d.ent).length,
  };
}

const modulosDe = (m, p) => (m.mods[p.name] || p.mods || DATOS.apps.map((a) => a.app))
  .filter((x) => APPS_VALIDAS.has(x));

function precioPlan(m, M, p) {
  const mods = modulosDe(m, p);
  const suma = mods.reduce((s, x) => s + M.porApp[x].sug, 0);
  const disc = Number.isFinite(m.disc[p.name]) ? m.disc[p.name] : p.disc;
  const precio = Math.round(suma * (1 - disc));
  return {
    mods,
    suma,
    disc,
    precio,
    peruser: precio / m.sup.usuarios,
    anual: Math.round(precio * 12 * (1 - m.sup.anual)),
    equivalente: stackDe(M, mods),
  };
}

/* Cuánto cuesta hoy, en el mercado, el subconjunto de necesidades que cubren
 * esos módulos. Es la única comparación que el cliente hace de verdad. */
function stackDe(M, mods) {
  const set = new Set(mods);
  return M.stack.filter((s) => set.has(s.app)).reduce((s, x) => s + x.cost, 0);
}

function veredictoBanda(precio, equivalente) {
  if (!equivalente) return { tono: 'ep-warn', txt: 'Sin equivalente de mercado para estos módulos: no hay ancla de comparación.' };
  const r = precio / equivalente;
  if (r > BANDA.max) return { tono: 'ep-bad', txt: '⚠ ' + pct(r) + ' del gasto actual: sobre el 60% se cae el argumento de ahorro y la venta se vuelve una discusión de features.' };
  if (r < BANDA.min) return { tono: 'ep-warn', txt: '⚠ ' + pct(r) + ' del gasto actual: bajo el 25% dejas margen sobre la mesa y siembras dudas sobre la calidad.' };
  return { tono: 'ep-ok', txt: '✓ ' + pct(r) + ' del gasto actual: dentro de la banda sana de 25%–60%.' };
}

/* ── Montaje ──────────────────────────────────────────────────────────── */

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;

  // Estado DENTRO de mount: una copia por ventana (regla de oro nº 2).
  let model = normalizar(null);
  let config = Object.assign({}, CONFIG_DEF);
  const listeners = new Set();
  const emitir = () => listeners.forEach((l) => l({ model, config }));

  let guardarT = null;
  const programarGuardado = () => {
    clearTimeout(guardarT);
    guardarT = setTimeout(() => {
      Promise.resolve(shell.saveData ? shell.saveData(model) : null).catch(() => {});
    }, 700);
  };

  function commit(parcial) {
    model = Object.assign({}, model, parcial);
    emitir();
    programarGuardado();
  }

  // Cambiar de pestaña o de filtro es estado de vista: no merece escribir disco.
  function irA(tab) {
    if (!TABS.some((t) => t.id === tab)) return false;
    model = Object.assign({}, model, { tab });
    emitir();
    return true;
  }
  function setFiltro(txt) {
    model = Object.assign({}, model, { filtro: String(txt || '').slice(0, 120) });
    emitir();
  }
  function setPanel(nombre) {
    model = Object.assign({}, model, { panel: nombre || '' });
    emitir();
  }

  /* Mutaciones — las comparten la UI y el agente. */

  const setSupuesto = (clave, valor) => {
    const lim = {
      usuarios: [1, 5000, true], canales: [1, 200, true],
      factor: [0.1, 2, false], anual: [0, 0.6, false],
    }[clave];
    if (!lim || !Number.isFinite(Number(valor))) return null;
    let v = clamp(Number(valor), lim[0], lim[1]);
    if (lim[2]) v = Math.round(v);
    commit({ sup: Object.assign({}, model.sup, { [clave]: v }) });
    return v;
  };

  const setFila = (id, parcial) => {
    let tocada = null;
    const det = model.det.map((d) => {
      if (d.id !== id) return d;
      tocada = filaLimpia(Object.assign({}, d, parcial), d.id);
      return tocada;
    });
    if (!tocada) return null;
    commit({ det });
    return tocada;
  };

  const addFila = (fila) => {
    const nueva = filaLimpia(fila || {});
    commit({ det: model.det.concat([nueva]) });
    return nueva;
  };

  const delFila = (id) => {
    const antes = model.det.length;
    const det = model.det.filter((d) => d.id !== id);
    if (det.length === antes) return false;
    commit({ det });
    return true;
  };

  const setDescuento = (nombre, valor) => {
    if (!PRESETS().some((p) => p.name === nombre) || !Number.isFinite(Number(valor))) return null;
    const v = clamp(Number(valor), 0, 0.95);
    commit({ disc: Object.assign({}, model.disc, { [nombre]: v }) });
    return v;
  };

  const setModulosPlan = (nombre, mods) => {
    const p = PRESETS().find((x) => x.name === nombre);
    if (!p || !Array.isArray(mods)) return null;
    const lista = mods.filter((x) => APPS_VALIDAS.has(x));
    commit({ mods: Object.assign({}, model.mods, { [nombre]: lista }) });
    return lista;
  };

  const toggleModuloPlan = (nombre, app) => {
    const p = PRESETS().find((x) => x.name === nombre);
    if (!p || !APPS_VALIDAS.has(app)) return null;
    const actual = modulosDe(model, p);
    const lista = actual.indexOf(app) >= 0 ? actual.filter((x) => x !== app) : actual.concat([app]);
    return setModulosPlan(nombre, lista);
  };

  // valor null / no numérico → vuelve al precio calculado por el modelo.
  const setPrecioModulo = (app, valor) => {
    if (!APPS_VALIDAS.has(app)) return null;
    const ovr = Object.assign({}, model.ovr);
    if (valor == null || valor === '' || !Number.isFinite(Number(valor))) delete ovr[app];
    else ovr[app] = Math.max(0, Math.round(Number(valor)));
    commit({ ovr });
    return ovr[app] == null ? null : ovr[app];
  };

  const setTexto = (app, campo, valor) => {
    if (!APPS_VALIDAS.has(app) || ['pro', 'con', 'strat'].indexOf(campo) < 0) return null;
    const previo = model.txt[app] || {};
    const txt = Object.assign({}, model.txt, {
      [app]: Object.assign({}, previo, { [campo]: String(valor == null ? '' : valor).slice(0, 2000) }),
    });
    commit({ txt });
    return true;
  };

  const setSeleccion = (mods) => {
    if (!Array.isArray(mods)) return null;
    const sel = mods.filter((x) => APPS_VALIDAS.has(x));
    commit({ sel });
    return sel;
  };

  const toggleSeleccion = (app) => {
    if (!APPS_VALIDAS.has(app)) return null;
    const sel = model.sel.indexOf(app) >= 0 ? model.sel.filter((x) => x !== app) : model.sel.concat([app]);
    commit({ sel });
    return sel;
  };

  const setCfgDisc = (v) => {
    if (!Number.isFinite(Number(v))) return null;
    const val = clamp(Number(v), 0, 0.95);
    commit({ cfgDisc: val });
    return val;
  };

  const aplicarPreset = (nombre) => {
    if (nombre === '__vaciar') { commit({ sel: [] }); return []; }
    const p = PRESETS().find((x) => x.name === nombre);
    if (!p) return null;
    const sel = modulosDe(model, p);
    commit({ sel, cfgDisc: Number.isFinite(model.disc[p.name]) ? model.disc[p.name] : p.disc });
    return sel;
  };

  const setPuntaje = (id, v) => {
    if (!PUNTAJES.some((p) => p.id === id) || !Number.isFinite(Number(v))) return null;
    const val = clamp(Math.round(Number(v)), 0, 10);
    commit({ puntajes: Object.assign({}, model.puntajes, { [id]: val }) });
    return val;
  };

  const setNotas = (txt) => { commit({ notas: String(txt == null ? '' : txt).slice(0, 8000) }); return true; };

  const restablecer = () => {
    const tab = model.tab;
    model = Object.assign(normalizar(null), { tab });
    emitir();
    programarGuardado();
    return true;
  };

  /* Carga inicial y preferencias (⚙️ Configurar). */

  Promise.resolve(shell.loadData ? shell.loadData() : null)
    .then((data) => { if (data) { model = normalizar(data); emitir(); } })
    .catch(() => {});

  const aplicarConfig = (valores) => {
    config = Object.assign({}, CONFIG_DEF, valores || {});
    emitir();
  };
  let offConfig = null;
  if (shell.config && shell.config.get) {
    Promise.resolve(shell.config.get()).then(aplicarConfig).catch(() => {});
    if (shell.config.onChange) offConfig = shell.config.onChange(aplicarConfig);
  }

  if (shell.window && shell.window.setTitle) shell.window.setTitle('Estudio de Precios KIMOS');

  if (shell.documents) {
    if (shell.documents.onSerialize) shell.documents.onSerialize(() => ({ model }));
    if (shell.documents.onLoad) {
      shell.documents.onLoad((doc) => { model = normalizar(doc && doc.model); emitir(); });
    }
  }

  /* ── Exportación ────────────────────────────────────────────────────── */

  function descargar(nombre, contenido, tipo) {
    try {
      const blob = new Blob([contenido], { type: tipo });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (shell.notify) shell.notify({ level: 'success', text: 'Archivo generado: ' + nombre });
    } catch (e) {
      if (shell.notify) shell.notify({ level: 'error', text: 'No se pudo generar el archivo.' });
    }
  }

  function exportarJSON() {
    const M = calcular(model);
    const salida = {
      version: APP_VERSION,
      generado: new Date().toISOString(),
      supuestos: model.sup,
      modulos: DATOS.apps.map((a) => Object.assign(
        { app: a.app, categoria: a.cat, alternativas: a.alts, target: a.tgt },
        M.porApp[a.app],
      )),
      planes: PRESETS().map((p) => {
        const c = precioPlan(model, M, p);
        return {
          nombre: p.name, tipo: DATOS.planes.indexOf(p) >= 0 ? 'plan' : 'kit',
          descuento: c.disc, suma_a_la_carta: c.suma, precio_mensual: c.precio,
          por_usuario: Math.round(c.peruser * 10) / 10, precio_anual: c.anual,
          equivalente_mercado: c.equivalente, modulos: c.mods,
        };
      }),
      stack_competencia: M.stack,
      stack_total: M.stackTotal,
      precios_competencia: model.det,
      puntajes: model.puntajes,
      notas: model.notas,
    };
    descargar('kimos_estudio_precios.json', JSON.stringify(salida, null, 2), 'application/json');
  }

  function exportarCSV() {
    const M = calcular(model);
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const filas = [['App KIMOS', 'Competidor', 'Plan', 'Precio USD', 'Unidad', 'Costo cliente tipo',
      'Segmento', 'Confianza', 'Notas', 'Fuente'].map(esc).join(',')];
    model.det.forEach((d) => {
      filas.push([d.app, d.comp, d.plan, d.price, d.unit, Math.round(d.price * M.factorUnidad(d.unit)),
        d.ent ? 'Enterprise' : 'PyME', d.conf, d.notes, d.src].map(esc).join(','));
    });
    filas.push('');
    filas.push(['App KIMOS', 'Mínimo', 'Mediana', 'Máximo', 'Sugerido KIMOS', 'Por usuario', 'Ahorro vs mediana']
      .map(esc).join(','));
    DATOS.apps.forEach((a) => {
      const x = M.porApp[a.app];
      filas.push([a.app, Math.round(x.min), Math.round(x.med), Math.round(x.max), x.sug,
        Math.round(x.peruser * 10) / 10, x.med ? pct(1 - x.sug / x.med) : '-'].map(esc).join(','));
    });
    // BOM: Excel en Windows abre el CSV con acentos correctos.
    descargar('kimos_estudio_precios.csv', '﻿' + filas.join('\n'), 'text/csv;charset=utf-8');
  }

  /* ── Agente IA ──────────────────────────────────────────────────────── */

  let offAgent = null;
  if (shell.agent && shell.agent.register) {
    offAgent = shell.agent.register({
      label: 'Estudio de Precios KIMOS',
      description: 'Estudio de mercado y modelo de suscripción de las 24 apps de KIMOS. '
        + 'Consulta precios de la competencia, medianas por categoría, precios sugeridos, planes, '
        + 'kits y el gasto que el cliente hace hoy en herramientas sueltas; y edita supuestos, '
        + 'precios, descuentos de bundle, composición de planes y puntajes del diagnóstico.',
      tools: [
        { name: 'IR_A_PESTANA', description: 'Cambia la pestaña visible del dashboard.',
          inputSchema: { type: 'object', properties: { tab: { type: 'string', enum: TABS.map((t) => t.id) } }, required: ['tab'] } },
        { name: 'SET_SUPUESTO',
          description: 'Fija un supuesto del cliente tipo: usuarios (1-5000), canales sociales (1-200), '
            + 'factor de posicionamiento (0,1-2 sobre la mediana del mercado) o descuento por pago anual (0-0,6).',
          inputSchema: { type: 'object', properties: {
            clave: { type: 'string', enum: ['usuarios', 'canales', 'factor', 'anual'] },
            valor: { type: 'number' },
          }, required: ['clave', 'valor'] } },
        { name: 'SET_PRECIO_COMPETIDOR',
          description: 'Cambia el precio mensual en USD de una fila de la competencia. Identifica la fila por id '
            + '(el que entrega GET_SNAPSHOT) o por competidor + plan.',
          inputSchema: { type: 'object', properties: {
            id: { type: 'string' }, competidor: { type: 'string' }, plan: { type: 'string' },
            precio: { type: 'number' },
            confianza: { type: 'string', enum: CONFIANZAS },
            notas: { type: 'string' }, fuente: { type: 'string' },
          }, required: ['precio'] } },
        { name: 'ADD_COMPETIDOR', description: 'Agrega una alternativa de la competencia a una app de KIMOS.',
          inputSchema: { type: 'object', properties: {
            app: { type: 'string', enum: DATOS.apps.map((a) => a.app) },
            competidor: { type: 'string' }, plan: { type: 'string' }, precio: { type: 'number' },
            unidad: { type: 'string', enum: UNIDADES },
            enterprise: { type: 'boolean', description: 'true = plan de segmento Enterprise; queda fuera del cálculo de mediana.' },
            confianza: { type: 'string', enum: CONFIANZAS },
            notas: { type: 'string' }, fuente: { type: 'string' },
          }, required: ['app', 'competidor', 'precio'] } },
        { name: 'REMOVE_COMPETIDOR', description: 'Elimina una fila de la competencia por id.',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'SET_PRECIO_MODULO',
          description: 'Fija a mano el precio sugerido de un módulo de KIMOS (USD/mes para el cliente tipo). '
            + 'Omitir "precio" devuelve el módulo al precio que calcula el modelo.',
          inputSchema: { type: 'object', properties: {
            app: { type: 'string', enum: DATOS.apps.map((a) => a.app) }, precio: { type: 'number' },
          }, required: ['app'] } },
        { name: 'SET_DESCUENTO_BUNDLE', description: 'Fija el descuento de bundle de un plan o kit (0 a 0,95).',
          inputSchema: { type: 'object', properties: {
            plan: { type: 'string', enum: PRESETS().map((p) => p.name) }, descuento: { type: 'number' },
          }, required: ['plan', 'descuento'] } },
        { name: 'SET_MODULOS_PLAN', description: 'Reemplaza la lista de módulos incluidos en un plan o kit.',
          inputSchema: { type: 'object', properties: {
            plan: { type: 'string', enum: PRESETS().map((p) => p.name) },
            modulos: { type: 'array', items: { type: 'string' } },
          }, required: ['plan', 'modulos'] } },
        { name: 'COTIZAR',
          description: 'Cotiza en el configurador un conjunto de módulos (o un plan/kit por nombre) y devuelve '
            + 'el precio, el equivalente de mercado y el veredicto de la banda 25%-60%.',
          inputSchema: { type: 'object', properties: {
            modulos: { type: 'array', items: { type: 'string' } },
            preset: { type: 'string' }, descuento: { type: 'number' },
          } } },
        { name: 'SET_TEXTO_APP', description: 'Edita el texto de pros, contras o estrategia de un módulo.',
          inputSchema: { type: 'object', properties: {
            app: { type: 'string', enum: DATOS.apps.map((a) => a.app) },
            campo: { type: 'string', enum: ['pro', 'con', 'strat'] },
            texto: { type: 'string' },
          }, required: ['app', 'campo', 'texto'] } },
        { name: 'SET_PUNTAJE', description: 'Fija un puntaje del diagnóstico (0 a 10).',
          inputSchema: { type: 'object', properties: {
            dimension: { type: 'string', enum: PUNTAJES.map((p) => p.id) }, valor: { type: 'number' },
          }, required: ['dimension', 'valor'] } },
        { name: 'SET_NOTAS', description: 'Reemplaza las notas del análisis.',
          inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
        { name: 'RESTABLECER', description: 'Devuelve todo el estudio a los datos originales de agosto de 2026.',
          inputSchema: { type: 'object', properties: {} } },
      ],

      getSnapshot: () => {
        const M = calcular(model);
        const ent = DATOS.planes.find((p) => p.name === 'Enterprise');
        const cEnt = ent ? precioPlan(model, M, ent) : null;
        return {
          version: APP_VERSION,
          pestana: model.tab,
          supuestos: model.sup,
          mercado: {
            filas: M.nDet, verificadas: M.nVer, enterprise_excluidas_de_mediana: M.nEnt,
            gasto_actual_cliente_tipo: Math.round(M.stackTotal),
            suma_modulos_sin_descuento: Math.round(M.total),
          },
          modulos: DATOS.apps.map((a) => ({
            app: a.app, categoria: a.cat, alternativas: a.alts,
            mediana: Math.round(M.porApp[a.app].med),
            sugerido: M.porApp[a.app].sug,
            fijado_a_mano: M.porApp[a.app].ovr != null,
            planes_relevados: M.porApp[a.app].n,
          })),
          planes: PRESETS().map((p) => {
            const c = precioPlan(model, M, p);
            return {
              nombre: p.name, tipo: DATOS.planes.indexOf(p) >= 0 ? 'plan' : 'kit',
              precio_mensual: c.precio, por_usuario: Math.round(c.peruser * 10) / 10,
              descuento: c.disc, modulos: c.mods, equivalente_mercado: Math.round(c.equivalente),
            };
          }),
          cotizacion_actual: (() => {
            const suma = model.sel.reduce((s, x) => s + (M.porApp[x] ? M.porApp[x].sug : 0), 0);
            const precio = Math.round(suma * (1 - model.cfgDisc));
            return { modulos: model.sel, descuento: model.cfgDisc, precio_mensual: precio,
              equivalente_mercado: Math.round(stackDe(M, model.sel)) };
          })(),
          filas_competencia: model.det.map((d) => ({
            id: d.id, app: d.app, competidor: d.comp, plan: d.plan, precio: d.price,
            unidad: d.unit, enterprise: d.ent, confianza: d.conf,
          })),
          puntajes: model.puntajes,
          notas: model.notas,
        };
      },

      dispatchAction: async (accion) => {
        const a = accion || {};
        const p = a.payload || {};
        try {
          switch (a.type) {
            case 'IR_A_PESTANA':
              return irA(p.tab)
                ? { success: true, message: 'Pestaña: ' + p.tab }
                : { success: false, error: 'Pestaña desconocida.' };

            case 'SET_SUPUESTO': {
              const v = setSupuesto(p.clave, p.valor);
              return v == null
                ? { success: false, error: 'Supuesto o valor inválido.' }
                : { success: true, message: p.clave + ' = ' + v };
            }

            case 'SET_PRECIO_COMPETIDOR': {
              let fila = p.id ? model.det.find((d) => d.id === p.id) : null;
              if (!fila && p.competidor) {
                const cands = model.det.filter((d) => d.comp.toLowerCase() === String(p.competidor).toLowerCase()
                  && (!p.plan || d.plan.toLowerCase() === String(p.plan).toLowerCase()));
                if (cands.length > 1) {
                  return { success: false, error: 'Hay ' + cands.length + ' filas que coinciden. Usa el id: '
                    + cands.map((d) => d.id + ' (' + d.app + '/' + d.plan + ')').join(', ') };
                }
                fila = cands[0];
              }
              if (!fila) return { success: false, error: 'No encontré esa fila de la competencia.' };
              const parcial = { price: p.precio };
              if (p.confianza) parcial.conf = p.confianza;
              if (p.notas != null) parcial.notes = p.notas;
              if (p.fuente != null) parcial.src = p.fuente;
              const out = setFila(fila.id, parcial);
              return { success: true, message: out.comp + ' ' + out.plan + ': ' + money(out.price) + ' (' + out.unit + ')' };
            }

            case 'ADD_COMPETIDOR': {
              if (!APPS_VALIDAS.has(p.app)) return { success: false, error: 'App de KIMOS desconocida.' };
              const nueva = addFila({
                app: p.app, comp: p.competidor, plan: p.plan || 'Estándar', price: p.precio,
                unit: p.unidad, ent: p.enterprise, conf: p.confianza, notes: p.notas, src: p.fuente,
              });
              return { success: true, message: 'Agregado ' + nueva.comp + ' a ' + nueva.app + ' (id ' + nueva.id + ')' };
            }

            case 'REMOVE_COMPETIDOR':
              return delFila(p.id)
                ? { success: true, message: 'Fila eliminada.' }
                : { success: false, error: 'No existe una fila con ese id.' };

            case 'SET_PRECIO_MODULO': {
              if (!APPS_VALIDAS.has(p.app)) return { success: false, error: 'App de KIMOS desconocida.' };
              const v = setPrecioModulo(p.app, p.precio == null ? null : p.precio);
              return { success: true, message: v == null
                ? p.app + ': vuelve al precio calculado por el modelo.'
                : p.app + ': precio fijado en ' + money(v) + '/mes.' };
            }

            case 'SET_DESCUENTO_BUNDLE': {
              const v = setDescuento(p.plan, p.descuento);
              return v == null
                ? { success: false, error: 'Plan o descuento inválido.' }
                : { success: true, message: p.plan + ': descuento ' + pct(v) };
            }

            case 'SET_MODULOS_PLAN': {
              const lista = setModulosPlan(p.plan, p.modulos);
              if (!lista) return { success: false, error: 'Plan inválido o lista de módulos vacía.' };
              const M = calcular(model);
              const preset = PRESETS().find((x) => x.name === p.plan);
              return { success: true, message: p.plan + ': ' + lista.length + ' módulos, '
                + money(precioPlan(model, M, preset).precio) + '/mes' };
            }

            case 'COTIZAR': {
              if (p.preset) {
                const sel = aplicarPreset(p.preset);
                if (!sel) return { success: false, error: 'No existe el plan o kit "' + p.preset + '".' };
              } else if (Array.isArray(p.modulos)) {
                const desconocidos = p.modulos.filter((x) => !APPS_VALIDAS.has(x));
                if (desconocidos.length) return { success: false, error: 'Módulos desconocidos: ' + desconocidos.join(', ') };
                setSeleccion(p.modulos);
              }
              if (p.descuento != null) setCfgDisc(p.descuento);
              irA('configurador');
              const M = calcular(model);
              const suma = model.sel.reduce((s, x) => s + M.porApp[x].sug, 0);
              const precio = Math.round(suma * (1 - model.cfgDisc));
              const eq = stackDe(M, model.sel);
              const ver = veredictoBanda(precio, eq);
              return { success: true, message: model.sel.length + ' módulos · ' + money(precio) + '/mes ('
                + money1(precio / model.sup.usuarios) + ' por usuario) · equivalente de mercado ' + money(eq)
                + ' · ' + ver.txt };
            }

            case 'SET_TEXTO_APP':
              return setTexto(p.app, p.campo, p.texto)
                ? { success: true, message: 'Texto actualizado en ' + p.app + '.' }
                : { success: false, error: 'App o campo inválido.' };

            case 'SET_PUNTAJE': {
              const v = setPuntaje(p.dimension, p.valor);
              return v == null
                ? { success: false, error: 'Dimensión o valor inválido.' }
                : { success: true, message: p.dimension + ' = ' + v + '/10' };
            }

            case 'SET_NOTAS':
              setNotas(p.texto);
              return { success: true, message: 'Notas actualizadas.' };

            case 'RESTABLECER':
              restablecer();
              return { success: true, message: 'Estudio restablecido a los datos originales.' };

            default:
              return { success: false, error: 'Acción no soportada: ' + a.type };
          }
        } catch (e) {
          return { success: false, error: 'Error al ejecutar la acción: ' + (e && e.message ? e.message : e) };
        }
      },
    });
  }

  /* ── Piezas de UI ───────────────────────────────────────────────────── */

  const svgIco = (nombre, clase) => h('svg', {
    className: clase, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
    dangerouslySetInnerHTML: { __html: ICONOS[nombre] || ICONOS.box },
  });

  // Campo numérico con edición local: no reescribe el modelo en cada tecla.
  function NumEdit(props) {
    const [txt, setTxt] = React.useState(String(props.value));
    const [foco, setFoco] = React.useState(false);
    React.useEffect(() => { if (!foco) setTxt(String(props.value)); }, [props.value, foco]);
    const cerrar = () => {
      setFoco(false);
      const limpio = txt.replace(',', '.').replace(/[^0-9.\-]/g, '');
      if (limpio === '' && props.vacioBorra) { props.onCommit(null); return; }
      const v = parseFloat(limpio);
      if (Number.isFinite(v)) props.onCommit(v); else setTxt(String(props.value));
    };
    return h('input', {
      type: 'text', inputMode: 'decimal', value: txt, title: props.title,
      className: 'ep-edit' + (props.chico ? ' w-sm' : ''),
      'aria-label': props.title || 'Valor editable',
      onFocus: () => setFoco(true),
      onChange: (e) => setTxt(e.target.value),
      onBlur: cerrar,
      onKeyDown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
        if (e.key === 'Escape') { setTxt(String(props.value)); setFoco(false); e.target.blur(); }
      },
    });
  }

  function TextEdit(props) {
    const [txt, setTxt] = React.useState(String(props.value || ''));
    const [foco, setFoco] = React.useState(false);
    React.useEffect(() => { if (!foco) setTxt(String(props.value || '')); }, [props.value, foco]);
    return h(props.filas ? 'textarea' : 'input', {
      type: props.filas ? undefined : 'text',
      rows: props.filas, value: txt, placeholder: props.placeholder,
      className: props.filas ? '' : 'ep-edit txt',
      style: props.filas ? { minHeight: (props.filas * 20) + 'px' } : null,
      // El placeholder puede ser decorativo ("—"): el nombre accesible va aparte.
      'aria-label': props.aria || props.placeholder || 'Texto editable',
      onFocus: () => setFoco(true),
      onChange: (e) => setTxt(e.target.value),
      onBlur: () => { setFoco(false); props.onCommit(txt); },
    });
  }

  const Kpi = (k, v, n, color) => h('div', { className: 'ep-kpi', style: { '--ep-g': color }, key: k },
    h('div', { className: 'ep-kpi-k' }, k),
    h('div', { className: 'ep-kpi-v' }, v),
    h('div', { className: 'ep-kpi-n' }, n));

  // Los hijos van desplegados (no como array): un array suelto haría que React
  // los trate como lista y exija `key` a cada bloque de contenido.
  const Card = (titulo, color, hint, ...hijos) => h('div', { className: 'ep-card' },
    h('h2', null, h('span', { className: 'ep-dot', style: { '--ep-g': color } }), titulo),
    hint ? h('p', { className: 'ep-hint' }, hint) : null,
    ...hijos);

  const Pill = (txt, clase) => h('span', { className: 'ep-pill ' + clase }, txt);

  /* Gráficos: HTML/SVG puro. Sin librería externa, para que la app cargue sin
   * red y los colores sigan al tema del host (§9 y checklist §8). */

  function BarrasH(props) {
    const max = Math.max.apply(null, props.filas.reduce((acc, f) => acc.concat(f.vals), [1]));
    return h('div', null,
      props.series.length > 1 ? h('div', { className: 'ep-leg' }, props.series.map((s, i) => h('span', { key: i },
        h('i', { className: 'ep-swatch', style: { background: s.color } }), s.label))) : null,
      h('div', { className: 'ep-bars', role: 'img', 'aria-label': props.aria || 'Gráfico de barras' },
        props.filas.map((f, i) => h('div', { className: 'ep-bar-row', key: i },
          h('div', { className: 'ep-bar-lb', title: f.lb }, f.lb),
          h('div', { className: 'ep-bar-stack' }, f.vals.map((v, j) => h('div', { className: 'ep-bar-line', key: j },
            h('div', { className: 'ep-bar-track' },
              h('i', { className: 'ep-bar-fill', style: {
                width: Math.max(0, (v / max) * 100) + '%',
                background: props.series[j] ? props.series[j].color : 'var(--ep-s1)',
              } })),
            h('span', { className: 'ep-bar-v' }, (props.fmt || money)(v)))))))));
  }

  function Columnas(props) {
    const max = Math.max.apply(null, props.items.map((x) => x.v).concat([1]));
    return h('div', { className: 'ep-cols', role: 'img', 'aria-label': props.aria || 'Gráfico de columnas' },
      props.items.map((x, i) => h('div', { className: 'ep-col-item', key: i, title: x.lb + ': ' + (props.fmt || money)(x.v) },
        h('span', { className: 'ep-col-v', style: { color: x.color } }, (props.fmt || money)(x.v)),
        h('div', { className: 'ep-col-bar', style: {
          height: Math.max(3, (x.v / max) * 100) + '%', background: x.color,
        } }),
        h('span', { className: 'ep-col-lb', title: x.lb }, x.lb))));
  }

  function Dona(props) {
    const total = props.items.reduce((s, x) => s + x.v, 0) || 1;
    const R = 52; const C = 2 * Math.PI * R;
    let acum = 0;
    return h('div', { className: 'ep-dona' },
      h('svg', { width: 140, height: 140, viewBox: '0 0 140 140', role: 'img',
        'aria-label': props.aria || 'Gráfico de anillo' },
        h('g', { transform: 'rotate(-90 70 70)' }, props.items.map((x, i) => {
          const largo = (x.v / total) * C;
          const el = h('circle', {
            key: i, cx: 70, cy: 70, r: R, fill: 'none', stroke: x.color, strokeWidth: 20,
            strokeDasharray: largo + ' ' + (C - largo), strokeDashoffset: -acum,
          }, h('title', null, x.lb + ': ' + money(x.v)));
          acum += largo;
          return el;
        })),
        h('text', { x: 70, y: 68, textAnchor: 'middle', className: 'ep-dona-c' }, money(total)),
        h('text', { x: 70, y: 82, textAnchor: 'middle', className: 'ep-dona-c2' }, props.centro || 'USD/mes')),
      h('div', { className: 'ep-dona-leg' }, props.items.map((x, i) => h('div', { key: i },
        h('i', { className: 'ep-swatch', style: { background: x.color } }),
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, x.lb),
        h('b', null, money(x.v))))));
  }

  const SERIE = (i) => 'var(--ep-s' + ((i % 12) + 1) + ')';

  /* ── Pestañas ───────────────────────────────────────────────────────── */

  function vistaResumen(m, M) {
    const ent = DATOS.planes.find((p) => p.name === 'Enterprise');
    const cEnt = precioPlan(m, M, ent);
    const ratio = M.stackTotal ? cEnt.precio / M.stackTotal : 0;
    const top = DATOS.apps.slice().sort((a, b) => M.porApp[b.app].sug - M.porApp[a.app].sug)
      .slice(0, 3).map((a) => nombreCorto(a.app));

    const tldr = [
      ['El número que importa', 'var(--ep-orange)',
        'Un cliente del tamaño tipo gasta hoy ' + money(M.stackTotal) + ' al mes armando el stack por su cuenta. '
        + 'Ese es el ancla de la negociación, no el precio de cada competidor suelto.'],
      ['Dónde está la plata', 'var(--ep-fuchsia)',
        top.join(', ') + ' concentran la disposición a pagar. Kanban, Formularios, Vitrina e Integraciones '
        + 'son commodities: sirven para entrar a la cuenta, no para facturar.'],
      ['La suma de partes no es un precio', 'var(--ep-violet)',
        'Sin descuento de bundle la suite daría ' + money(M.total) + '/mes. Nadie paga eso. El descuento por plan '
        + 'no es una concesión comercial: es el modelo de precio.'],
      ['No todo se cobra por asiento', 'var(--ep-cyan)',
        'Cashflow, PIM, Tienda, BPM y Eventos se cobran plano en todo el mercado. Cobrarlos por usuario deja a '
        + 'KIMOS fuera de comparación justo cuando el cliente arma su planilla.'],
      ['Dos categorías a no pelear', 'var(--ep-red)',
        'Chat de equipo (Slack/Teams) y e-commerce (Shopify) tienen efecto de red y ecosistemas imposibles de '
        + 'igualar en el corto plazo. Integrarse rinde más que competir.'],
      ['El riesgo real', 'var(--ep-amber)',
        '24 módulos son una superficie de producto enorme para mantener. La amenaza no es el precio de la '
        + 'competencia: es quedarse a medias en veinte frentes a la vez.'],
    ];

    // Las herramientas menores se agrupan en "Otras": el centro del anillo debe
    // sumar el gasto real del cliente, no el subtotal de las que caben en la leyenda.
    const ordenado = M.stack.slice().sort((a, b) => b.cost - a.cost);
    const stackTop = ordenado.slice(0, 8).map((s, i) => ({ lb: s.comp, v: s.cost, color: SERIE(i) }));
    const resto = ordenado.slice(8);
    const restoTotal = resto.reduce((s, x) => s + x.cost, 0);
    if (restoTotal > 0) stackTop.push({ lb: 'Otras ' + resto.length + ' herramientas', v: restoTotal, color: 'var(--ep-s12)' });
    const planesCols = DATOS.planes.map((p, i) => ({
      lb: p.name, v: Math.round(precioPlan(m, M, p).peruser * 10) / 10, color: SERIE(i),
    })).concat([{ lb: 'Stack actual', v: Math.round(M.stackTotal / m.sup.usuarios * 10) / 10, color: 'var(--ep-orange)' }]);

    return h('div', null,
      h('div', { className: 'ep-note' },
        h('b', null, 'Cómo leer esto. '),
        'Todo se recalcula solo. Mueve los controles de ', h('em', null, 'Precios por app'),
        ' o edita cualquier precio de la competencia y el modelo completo se actualiza: planes, kits, '
        + 'configurador y gráficos. Lo que edites se guarda en esta instancia.'),
      h('div', { className: 'ep-g2' },
        Card('Precio sugerido KIMOS vs. mediana del mercado', 'var(--ep-cyan)',
          'Por módulo, normalizado al cliente tipo de ' + m.sup.usuarios + ' usuarios. Violeta: el mercado. Calipso: KIMOS.',
          h(BarrasH, {
            aria: 'Mediana del mercado contra precio sugerido de KIMOS por módulo',
            series: [{ label: 'Mediana del mercado', color: 'var(--ep-violet)' },
              { label: 'Sugerido KIMOS', color: 'var(--ep-cyan)' }],
            filas: DATOS.apps.map((a) => ({ lb: nombreCorto(a.app), vals: [M.porApp[a.app].med, M.porApp[a.app].sug] })),
          })),
        h('div', { className: 'ep-col' },
          Card('El gasto que KIMOS reemplaza', 'var(--ep-fuchsia)',
            'Stack best-of-breed que arma hoy una empresa del tamaño tipo. Total: ' + money(M.stackTotal) + '/mes.',
            h(Dona, { items: stackTop, aria: 'Reparto del gasto actual del cliente por herramienta' })),
          Card('Escalera de planes', 'var(--ep-orange)',
            'Precio mensual por usuario de cada plan frente al costo del stack actual.',
            h(Columnas, { items: planesCols, fmt: money1, aria: 'Precio por usuario de cada plan' })))),
      Card('Lo que dice el estudio, en seis frases', 'var(--ep-green)', null,
        h('div', { className: 'ep-g3' }, tldr.map((t, i) => h('div', { className: 'ep-diag', key: i, style: { '--ep-g': t[1] } },
          h('h4', null, t[0]), h('p', null, t[2]))))));
  }

  function vistaMapa(m, M) {
    return Card('Mapa competitivo por aplicación', 'var(--ep-violet)',
      'Cada app de KIMOS, contra quién compite, en qué rango se mueve el mercado y a qué precio conviene entrar. '
      + 'La columna "Sugerido" es editable: al escribir un valor, ese módulo deja de seguir el modelo y queda fijo '
      + '(vacíala para volver al cálculo). La mediana excluye los planes Enterprise.',
      h('div', { className: 'ep-tw' }, h('table', null,
        h('thead', null, h('tr', null,
          ['App KIMOS', 'Categoría de mercado', 'Alternativas', 'Target'].map((t) => h('th', { key: t }, t)),
          ['Mín', 'Mediana', 'Máx', 'Sugerido', 'Por usuario', 'Ahorro'].map((t) => h('th', { key: t, className: 'num' }, t)),
          h('th', null, 'Datos'))),
        h('tbody', null, DATOS.apps.map((a) => {
          const x = M.porApp[a.app];
          return h('tr', { key: a.app },
            h('td', null, h('b', null, a.app), h('div', { className: 'ep-sub-td' }, a.desc)),
            h('td', null, a.cat, x.soloEnt ? h('div', { className: 'ep-sub-td ep-warn' }, 'Solo planes Enterprise: mediana sesgada') : null),
            h('td', { className: 'ep-sub-td', style: { maxWidth: '190px' } }, a.alts),
            h('td', null, Pill(a.tgt, 'v')),
            h('td', { className: 'num' }, money(x.min)),
            h('td', { className: 'num', style: { color: 'var(--ep-fuchsia)', fontWeight: 700 } }, money(x.med)),
            h('td', { className: 'num', style: { color: 'var(--ep-dim)' } }, money(x.max)),
            h('td', { className: 'num' },
              h(NumEdit, {
                value: x.sug, chico: true, vacioBorra: true,
                title: 'Precio sugerido de ' + a.app + '. Vacía el campo para volver al calculado (' + money(x.calc) + ').',
                onCommit: (v) => setPrecioModulo(a.app, v),
              }),
              x.ovr != null ? h('div', { className: 'ep-sub-td' }, 'fijo · modelo ' + money(x.calc)) : null),
            h('td', { className: 'num' }, money1(x.peruser)),
            h('td', { className: 'num', style: { color: 'var(--ep-green)' } }, x.med ? pct(1 - x.sug / x.med) : '—'),
            h('td', null, Pill(x.ver + '/' + x.n, x.n && x.ver >= x.n * 0.7 ? 'ok' : 'est')));
        })))));
  }

  function vistaPrecios(m, M, cfg) {
    const q = (m.filtro || '').toLowerCase();
    const filas = m.det.filter((d) => !q || (d.app + ' ' + d.comp + ' ' + d.plan).toLowerCase().indexOf(q) >= 0);
    const ctrl = (label, clave, min, max, step, valor, fmt) => h('div', { className: 'ep-ctrl', key: clave },
      h('label', { htmlFor: 'ep-' + clave }, label),
      h('div', { className: 'ep-ctrl-row' },
        h('input', {
          id: 'ep-' + clave, type: 'range', min, max, step, value: valor,
          onChange: (e) => setSupuesto(clave, e.target.value),
        }),
        h('span', { className: 'ep-val' }, fmt(valor))));

    return h('div', null,
      h('div', { className: 'ep-ctrls' },
        ctrl('Usuarios del cliente tipo', 'usuarios', 1, 200, 1, m.sup.usuarios, String),
        ctrl('Canales sociales', 'canales', 1, 30, 1, m.sup.canales, String),
        ctrl('Factor de posicionamiento', 'factor', 0.2, 1.2, 0.05, m.sup.factor, (v) => v.toFixed(2)),
        ctrl('Descuento pago anual', 'anual', 0, 0.4, 0.01, m.sup.anual, pct)),
      h('div', { className: 'ep-note' },
        h('b', null, 'Factor de posicionamiento. '),
        '0,55 significa entrar un 45% bajo la mediana del mercado: estrategia challenger, se gana por precio. '
        + 'Súbelo a 0,80–0,90 si la venta se gana por integración de suite y no por ser el más barato. '
        + 'Es la palanca más sensible de todo el modelo.'),
      Card('Detalle de precios de la competencia', 'var(--ep-teal)',
        'Precio, unidad, segmento y confianza son editables: cambia cualquiera y el modelo entero se recalcula. '
        + M.nVer + ' de ' + M.nDet + ' precios están verificados contra la tarifa publicada del proveedor; '
        + 'el resto corresponde a proveedores que no publican precio (Agicap, Cvent, Salsify, Bizzabo) '
        + 'y debe validarse antes de publicar tarifas.',
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '11px', alignItems: 'center' } },
          h('input', {
            type: 'text', value: m.filtro, placeholder: 'Filtrar por app o competidor…',
            style: { minWidth: '240px' }, 'aria-label': 'Filtrar filas',
            onChange: (e) => setFiltro(e.target.value),
          }),
          h('span', { className: 'ep-hint', style: { margin: 0 } }, filas.length + ' de ' + M.nDet + ' filas'),
          h('button', {
            type: 'button', className: 'ep-btn', style: { marginLeft: 'auto' },
            onClick: () => {
              const nueva = addFila({ app: DATOS.apps[0].app, comp: 'Nuevo competidor', plan: 'Estándar',
                price: 0, unit: 'Por usuario', conf: 'Estimado - verificar' });
              setFiltro(nueva.comp);
            },
          }, '+ Agregar competidor')),
        h('div', { className: 'ep-tw alto' }, h('table', null,
          h('thead', null, h('tr', null,
            h('th', null, 'App KIMOS'), h('th', null, 'Competidor'), h('th', null, 'Plan'),
            h('th', { className: 'num' }, 'USD/mes'), h('th', null, 'Unidad'),
            h('th', { className: 'num' }, 'Cliente tipo'), h('th', null, 'Segmento'),
            h('th', null, 'Confianza'), h('th', null, 'Notas'),
            cfg.mostrarFuentes ? h('th', null, 'Fuente') : null, h('th', null, ''))),
          h('tbody', null, filas.map((d) => h('tr', { key: d.id },
            h('td', null, h('select', {
              value: d.app, 'aria-label': 'App de KIMOS',
              onChange: (e) => setFila(d.id, { app: e.target.value }),
            }, DATOS.apps.map((a) => h('option', { key: a.app, value: a.app }, nombreCorto(a.app))))),
            h('td', null, h(TextEdit, { value: d.comp, placeholder: 'Competidor', aria: 'Competidor de ' + d.app,
              onCommit: (v) => setFila(d.id, { comp: v }) })),
            h('td', null, h(TextEdit, { value: d.plan, placeholder: 'Plan', aria: 'Plan de ' + d.comp,
              onCommit: (v) => setFila(d.id, { plan: v }) })),
            h('td', { className: 'num' }, h(NumEdit, {
              value: d.price, title: 'Precio de lista en USD/mes',
              onCommit: (v) => setFila(d.id, { price: v }),
            })),
            h('td', null, h('select', {
              value: d.unit, 'aria-label': 'Unidad de cobro',
              onChange: (e) => setFila(d.id, { unit: e.target.value }),
            }, UNIDADES.map((u) => h('option', { key: u, value: u }, u)))),
            h('td', { className: 'num', style: { color: 'var(--ep-cyan)', fontWeight: 650 } },
              money(d.price * M.factorUnidad(d.unit))),
            h('td', null, h('button', {
              type: 'button', className: 'ep-btn sm', title: 'Los planes Enterprise quedan fuera del cálculo de mediana',
              onClick: () => setFila(d.id, { ent: !d.ent }),
            }, d.ent ? Pill('Enterprise', 'ent') : Pill('PyME', 'v'))),
            h('td', null, h('button', {
              type: 'button', className: 'ep-btn sm',
              onClick: () => setFila(d.id, { conf: d.conf === 'Verificado' ? 'Estimado - verificar' : 'Verificado' }),
            }, d.conf === 'Verificado' ? Pill('Verificado', 'ok') : Pill('Estimado', 'est'))),
            h('td', { style: { maxWidth: '200px' } }, h(TextEdit, { value: d.notes, placeholder: '—', aria: 'Notas de ' + d.comp + ' ' + d.plan,
              onCommit: (v) => setFila(d.id, { notes: v }) })),
            cfg.mostrarFuentes
              ? h('td', { className: 'ep-sub-td', style: { maxWidth: '170px', wordBreak: 'break-all' } }, d.src || '—')
              : null,
            h('td', null, h('button', {
              type: 'button', className: 'ep-btn sm danger', title: 'Eliminar fila',
              onClick: () => delFila(d.id),
            }, '✕'))))))),
        filas.length ? null : h('div', { className: 'ep-empty' },
          'Ningún competidor coincide con "' + m.filtro + '". ',
          h('button', { type: 'button', className: 'ep-btn sm', onClick: () => setFiltro('') }, 'Ver las ' + M.nDet + ' filas'))));
  }

  function vistaPlanes(m, M) {
    const tarjeta = (p, hot) => {
      const c = precioPlan(m, M, p);
      const abierto = m.panel === p.name;
      return h('div', { className: 'ep-plan' + (hot ? ' hot' : ''), key: p.name },
        hot ? h('div', { className: 'ep-plan-tag' }, 'MÁS VENDIBLE') : null,
        h('h3', null, p.name),
        h('div', { className: 'ep-plan-who' }, p.tgt),
        h('div', { className: 'ep-plan-pz' }, money(c.precio)),
        h('div', { className: 'ep-plan-pu' }, 'al mes · ' + money1(c.peruser) + ' por usuario'),
        h('div', { className: 'ep-plan-desc' }, p.desc),
        h('div', { className: 'ep-qline' }, h('span', null, 'Suma a la carta'), h('b', null, money(c.suma))),
        h('div', { className: 'ep-qline' }, h('span', null, 'Descuento bundle'),
          h('b', null, h(NumEdit, {
            value: Math.round(c.disc * 100), chico: true, title: 'Descuento de bundle en %',
            onCommit: (v) => setDescuento(p.name, v / 100),
          }), ' %')),
        h('div', { className: 'ep-qline' }, h('span', null, 'Precio anual'), h('b', null, money(c.anual))),
        h('div', { className: 'ep-qline' }, h('span', null, 'Equivalente de mercado'),
          h('b', { style: { color: 'var(--ep-orange)' } }, money(c.equivalente))),
        h('div', { className: 'ep-qline' }, h('span', null, 'Módulos incluidos'),
          h('b', null, c.mods.length, ' ',
            h('button', {
              type: 'button', className: 'ep-btn sm',
              onClick: () => setPanel(abierto ? '' : p.name),
            }, abierto ? 'Listo' : 'Editar'))),
        abierto ? h('div', { className: 'ep-mods-edit' },
          h('div', { className: 'ep-modgrid' }, DATOS.apps.map((a) => h('label', {
            key: a.app, className: 'ep-mod' + (c.mods.indexOf(a.app) >= 0 ? ' on' : ''),
          },
            h('input', {
              type: 'checkbox', checked: c.mods.indexOf(a.app) >= 0,
              onChange: () => toggleModuloPlan(p.name, a.app),
            }),
            h('span', { className: 'ep-mod-nm', title: a.app }, nombreCorto(a.app)),
            h('span', { className: 'ep-mod-pz' }, money(M.porApp[a.app].sug)))))) : null);
    };

    const ent = DATOS.planes.find((p) => p.name === 'Enterprise');
    const cEnt = precioPlan(m, M, ent);
    const ratio = M.stackTotal ? cEnt.precio / M.stackTotal : 0;
    const resumen = [
      ['Costo por usuario del stack actual', money1(M.stackTotal / m.sup.usuarios), 'var(--ep-orange)'],
      ['KIMOS Enterprise mensual', money(cEnt.precio), 'var(--ep-violet)'],
      ['KIMOS Enterprise por usuario', money1(cEnt.peruser), 'var(--ep-violet)'],
      ['KIMOS como % del gasto actual', pct(ratio), ratio >= BANDA.min && ratio <= BANDA.max ? 'var(--ep-green)' : 'var(--ep-red)'],
      ['Ahorro anual para el cliente', money(Math.max(0, (M.stackTotal - cEnt.precio) * 12)), 'var(--ep-cyan)'],
    ];

    return h('div', null,
      Card('Planes por tamaño de empresa', 'var(--ep-fuchsia)',
        'El descuento de bundle y la composición de cada plan son editables. Sin descuento, la suma de módulos '
        + 'da un precio que ningún cliente paga.',
        h('div', { className: 'ep-g3' }, DATOS.planes.map((p) => tarjeta(p, p.name === 'Business')))),
      Card('Kits por necesidad del cliente', 'var(--ep-teal)',
        'Para clientes que no necesitan la suite completa sino resolver un frente concreto. Los aprueba un gerente '
        + 'de área con presupuesto propio, sin comité de compra.',
        h('div', { className: 'ep-g3' }, DATOS.kits.map((p) => tarjeta(p, false)))),
      Card('Chequeo de realidad', 'var(--ep-orange)',
        'Lo que gasta hoy el cliente tipo armando el stack por su cuenta. Es el número contra el que se negocia.',
        h('div', { className: 'ep-g2' },
          h('div', { className: 'ep-tw' }, h('table', null,
            h('thead', null, h('tr', null, h('th', null, 'Necesidad'), h('th', null, 'Herramienta actual'),
              h('th', null, 'Plan'), h('th', { className: 'num' }, 'USD/mes'))),
            h('tbody', null,
              M.stack.map((s, i) => h('tr', { key: i },
                h('td', null, s.need), h('td', null, h('b', null, s.comp)),
                h('td', { className: 'ep-sub-td' }, s.plan),
                h('td', { className: 'num', style: { color: 'var(--ep-orange)', fontWeight: 650 } }, money(s.cost)))),
              h('tr', { className: 'ep-tot-row' },
                h('td', { colSpan: 3 }, 'TOTAL stack best-of-breed'),
                h('td', { className: 'num', style: { color: 'var(--ep-orange)' } }, money(M.stackTotal)))))),
          h('div', null,
            resumen.map((x, i) => h('div', { className: 'ep-qline', key: i, style: { fontSize: '13px' } },
              h('span', null, x[0]), h('b', { style: { color: x[2], fontSize: '16px' } }, x[1]))),
            h('div', { className: 'ep-note', style: { marginTop: '13px' } },
              h('b', null, 'Regla de calibración. '),
              'La banda sana es 25%–60% del gasto actual del cliente. Sobre 60% se cae el argumento de ahorro y la '
              + 'venta se vuelve una discusión de features. Bajo 25% dejas margen sobre la mesa y además generas '
              + 'dudas sobre la calidad del producto.')))));
  }

  function vistaConfigurador(m, M) {
    const suma = m.sel.reduce((s, x) => s + (M.porApp[x] ? M.porApp[x].sug : 0), 0);
    const precio = Math.round(suma * (1 - m.cfgDisc));
    const eq = stackDe(M, m.sel);
    const ver = veredictoBanda(precio, eq);

    return Card('Configurador de suscripción', 'var(--ep-cyan)',
      'Marca los módulos que necesita el cliente y obtén la cotización al instante, comparada contra lo que '
      + 'gastaría comprando cada herramienta por separado.',
      h('div', { className: 'ep-cfg' },
        h('div', null,
          h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '12px' } },
            PRESETS().map((p) => h('button', {
              key: p.name, type: 'button', className: 'ep-btn',
              onClick: () => aplicarPreset(p.name),
            }, p.name)),
            h('button', { type: 'button', className: 'ep-btn danger', onClick: () => aplicarPreset('__vaciar') }, 'Vaciar')),
          h('div', { className: 'ep-modgrid' }, DATOS.apps.map((a) => h('label', {
            key: a.app, className: 'ep-mod' + (m.sel.indexOf(a.app) >= 0 ? ' on' : ''),
          },
            h('input', {
              type: 'checkbox', checked: m.sel.indexOf(a.app) >= 0,
              onChange: () => toggleSeleccion(a.app),
            }),
            h('span', { className: 'ep-mod-nm', title: a.app + ' — ' + a.cat }, nombreCorto(a.app)),
            h('span', { className: 'ep-mod-pz' }, money(M.porApp[a.app].sug)))))),
        h('div', null, h('div', { className: 'ep-quote' },
          h('div', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'var(--ep-dim)', fontWeight: 700 } }, 'Cotización'),
          h('div', { className: 'ep-qbig' }, money(precio)),
          h('div', { style: { color: 'var(--ep-mut)', fontSize: '12px', marginBottom: '12px' } },
            'al mes · ' + money1(precio / m.sup.usuarios) + ' por usuario · ' + m.sel.length + ' módulos'),
          h('div', { className: 'ep-qline' }, h('span', null, 'Suma a la carta'), h('b', null, money(suma))),
          h('div', { className: 'ep-qline' }, h('span', null, 'Descuento bundle'),
            h('b', null, h(NumEdit, {
              value: Math.round(m.cfgDisc * 100), chico: true, title: 'Descuento de bundle en %',
              onCommit: (v) => setCfgDisc(v / 100),
            }), ' %')),
          h('div', { className: 'ep-qline' }, h('span', null, 'Precio anual'),
            h('b', null, money(precio * 12 * (1 - m.sup.anual)))),
          h('div', { className: 'ep-qline' }, h('span', null, 'Equivalente en el mercado'),
            h('b', { style: { color: 'var(--ep-orange)' } }, money(eq))),
          h('div', { className: 'ep-qline' }, h('span', null, 'Ahorro anual del cliente'),
            h('b', { style: { color: 'var(--ep-green)' } }, money(Math.max(0, (eq - precio) * 12)))),
          h('div', { className: 'ep-hint ' + ver.tono, style: { marginTop: '12px', marginBottom: 0 } },
            m.sel.length ? ver.txt : 'Selecciona módulos para cotizar.')))));
  }

  function vistaVersus(m, M) {
    return h('div', null,
      h('div', { className: 'ep-note' },
        h('b', null, 'Sin adornos. '),
        'Cada tarjeta dice qué tiene KIMOS a favor y qué tiene en contra frente a la competencia real de esa '
        + 'categoría. Donde la posición es mala, lo dice. Un estudio que solo lista fortalezas no sirve para '
        + 'decidir precios. Los tres textos son editables: haz clic y escribe.'),
      h('div', { className: 'ep-g3' }, DATOS.apps.map((a, i) => {
        const x = M.porApp[a.app];
        const t = m.txt[a.app] || {};
        const val = (campo) => (t[campo] != null ? t[campo] : a[campo]);
        return h('div', { className: 'ep-appcard', key: a.app },
          h('div', { className: 'ep-appcard-top' },
            h('div', { className: 'ep-ico', style: { '--ep-c1': SERIE(i), '--ep-c2': SERIE(i + 4) } },
              svgIco(a.icon)),
            h('div', { style: { minWidth: 0 } },
              h('div', { className: 'ep-appcard-nm' }, a.app),
              h('div', { className: 'ep-appcard-cat' }, a.cat))),
          h('div', { className: 'ep-sub-td', style: { marginBottom: '4px' } }, 'Compite con: ' + a.alts),
          h('div', { className: 'ep-pc pro' }, h('b', null, 'A favor'),
            h(TextEdit, { value: val('pro'), filas: 3, aria: 'A favor de ' + a.app, onCommit: (v) => setTexto(a.app, 'pro', v) })),
          h('div', { className: 'ep-pc con' }, h('b', null, 'En contra'),
            h(TextEdit, { value: val('con'), filas: 3, aria: 'En contra de ' + a.app, onCommit: (v) => setTexto(a.app, 'con', v) })),
          h('div', { className: 'ep-prow' },
            h('div', null, 'Mercado ', h('b', null, money(x.min) + '–' + money(x.max))),
            h('div', null, 'Sugerido ', h('b', null, money(x.sug))),
            h('div', null, 'Target ', h('b', null, a.tgt))),
          h('div', { className: 'ep-strat' }, h('b', null, 'Estrategia: '),
            h(TextEdit, { value: val('strat'), filas: 2, aria: 'Estrategia de ' + a.app, onCommit: (v) => setTexto(a.app, 'strat', v) })));
      })));
  }

  function vistaDiagnostico(m, M) {
    const ent = DATOS.planes.find((p) => p.name === 'Enterprise');
    const cEnt = precioPlan(m, M, ent);
    const ratio = M.stackTotal ? cEnt.precio / M.stackTotal : 0;
    const kits = DATOS.kits.map((k) => precioPlan(m, M, k).precio);
    const kMin = money(Math.min.apply(null, kits.concat([Infinity])));
    const kMax = money(Math.max.apply(null, kits.concat([0])));
    const nEst = M.nDet - M.nVer;

    const valor = DATOS.apps.map((a) => ({
      n: nombreCorto(a.app), v: M.total ? M.porApp[a.app].sug / M.total * 100 : 0,
    })).sort((a, b) => b.v - a.v).slice(0, 12);

    const sugerencias = [
      ['Fusiona Digitai con Agentes', 'var(--ep-fuchsia)',
        'Son la misma promesa para el cliente: automatizar con IA. Dos SKUs que se solapan generan fricción en la '
        + 'venta y canibalizan precio. Un solo módulo con niveles de consumo es más claro y más caro de vender bien.'],
      ['No pelees el chat ni el e-commerce', 'var(--ep-red)',
        'Equipos compite con Slack y Teams, que tienen efecto de red; Tienda compite con Shopify y su app store. '
        + 'Integrarse con ellos convierte dos debilidades en dos argumentos de venta. Insistir cuesta roadmap que '
        + 'rinde más en BPM o PIM.'],
      ['Concentra el roadmap en cinco módulos', 'var(--ep-violet)',
        'Prospección, PIM, BPM, Dashboards y Agentes Web concentran la disposición a pagar. Los demás son de '
        + 'retención, no de ingreso. Repartir esfuerzo por igual entre 24 módulos es la forma más rápida de quedar '
        + 'mediocre en todos.'],
      ['Cobra por unidad de valor, no por asiento', 'var(--ep-cyan)',
        'Cashflow por empresa, PIM por volumen de SKU, Social Planner por canal, Eventos por evento, Agentes por '
        + 'crédito. Forzar todo a "por usuario" deja a KIMOS fuera de comparación justo cuando el cliente arma su planilla.'],
      ['Vende kits antes que la suite completa', 'var(--ep-teal)',
        'El Enterprise de ' + money(cEnt.precio) + '/mes exige un comité de compra y un ciclo largo. Los kits de '
        + kMin + '–' + kMax + ' los aprueba un gerente de área con presupuesto propio. Entra por el kit, expande '
        + 'después: el costo de adquisición es una fracción.'],
      ['Publica precios', 'var(--ep-orange)',
        'Pipedrive, Shopify, Notion y Plytix publican todo. Los que no publican (Agicap, Cvent, Salsify) juegan en '
        + 'enterprise con equipo de ventas. Si KIMOS apunta a PyME y no publica precios, pierde antes de la primera reunión.'],
      ['Instrumenta el uso por módulo', 'var(--ep-blue)',
        'Sin datos de adopción por módulo, el pricing es una hipótesis. Medir qué se usa de verdad permite mover '
        + 'módulos entre planes con evidencia y detectar cuáles no justifican su costo de mantención.'],
      ['Cierra la brecha de datos', 'var(--ep-amber)',
        nEst + ' de ' + M.nDet + ' precios siguen sin verificar y Agicap, Cvent y Salsify no publican tarifas. '
        + 'Antes de fijar lista definitiva conviene cerrar esa brecha: una mediana mal calculada arrastra el error '
        + 'a todo el modelo aguas abajo.'],
    ];

    const bloque = (color, titulo, cuerpo) => h('div', { className: 'ep-diag', style: { '--ep-g': color } },
      h('h4', null, titulo), h('p', { dangerouslySetInnerHTML: { __html: cuerpo } }));

    return h('div', null,
      h('div', { className: 'ep-g2' },
        Card('Dónde está parado KIMOS', 'var(--ep-green)',
          'Evaluación por dimensión, de 0 a 10, según la posición competitiva que muestra este estudio. '
          + 'Los puntajes son editables: son un juicio, no un dato.',
          PUNTAJES.map((p) => h('div', { key: p.id },
            h('div', { className: 'ep-score' },
              h('span', { className: 'ep-score-lb' }, p.lb),
              h('span', { className: 'ep-score-bar' }, h('i', { style: { width: (m.puntajes[p.id] * 10) + '%' } })),
              h('input', {
                type: 'range', min: 0, max: 10, step: 1, value: m.puntajes[p.id],
                style: { maxWidth: '90px', flex: 'none' }, 'aria-label': 'Puntaje de ' + p.lb,
                onChange: (e) => setPuntaje(p.id, e.target.value),
              }),
              h('span', { className: 'ep-score-n' }, m.puntajes[p.id] + '/10')),
            h('div', { className: 'ep-score-help' }, p.help)))),
        Card('Concentración del valor', 'var(--ep-cyan)',
          'Qué porcentaje del precio total de la suite aporta cada módulo. Muestra de qué depende realmente el ingreso.',
          h(BarrasH, {
            aria: 'Participación de cada módulo en el precio total de la suite',
            series: [{ label: '% del precio total', color: 'var(--ep-fuchsia)' }],
            fmt: (v) => (Math.round(v * 10) / 10) + '%',
            filas: valor.map((x) => ({ lb: x.n, vals: [x.v] })),
          }))),
      Card('Sugerencias y mejoras', 'var(--ep-fuchsia)', null,
        sugerencias.map((s, i) => h('div', { className: 'ep-diag', key: i, style: { '--ep-g': s[1] } },
          h('h4', null, s[0]), h('p', null, s[2])))),
      Card('Conclusión: desarrollo, implementación y escalabilidad', 'var(--ep-orange)', null,
        bloque('var(--ep-green)', 'Desarrollo: la apuesta es correcta, la ejecución es el riesgo',
          'KIMOS no está compitiendo con Trello ni con Pipedrive. Está compitiendo con <b>la suma de doce '
          + 'suscripciones sueltas</b>, y ahí la posición es genuinamente buena: ' + money(M.stackTotal)
          + ' al mes de gasto disperso contra ' + money(cEnt.precio) + ' integrados. Ese diferencial es real y '
          + 'defendible. Pero la amplitud que hoy es la ventaja es también la amenaza: ninguna organización pequeña '
          + 'mantiene 24 módulos al nivel de sus especialistas. La pregunta no es si KIMOS puede construirlos '
          + '—evidentemente ya lo hizo— sino si puede sostenerlos sin que la calidad promedio caiga por debajo del '
          + 'umbral en que el cliente empieza a recomprar herramientas sueltas por fuera. Ese es el punto de quiebre a vigilar.'),
        bloque('var(--ep-cyan)', 'Implementación: el producto se vende solo si el onboarding no lo hunde',
          'Los módulos de mayor valor —PIM, BPM, Cashflow— son justamente los que exigen migración de datos, '
          + 'integración con bancos o ERPs locales y consultoría de procesos. En PIM, la industria entera sabe que '
          + 'el proyecto se juega en la preparación de datos, no en el software. Si KIMOS los vende como '
          + 'autoservicio, el churn se lo come en el primer trimestre. Recomendación concreta: precio de licencia '
          + 'agresivo y <b>onboarding pagado y obligatorio</b> en esos tres módulos, al estilo del fee de USD 1.500 '
          + 'de HubSpot. Eso filtra clientes que no están listos y financia el costo real de implementar.'),
        bloque('var(--ep-fuchsia)', 'Escalabilidad: el modelo escala, la organización es la duda',
          'Comercialmente el modelo escala bien: la estructura de kits permite entrar barato y expandir sin '
          + 'renegociar el contrato, y el precio por unidad de valor —SKU, canal, evento, crédito— crece con el '
          + 'cliente sin castigar la adopción interna, que es el error clásico del cobro por asiento. Técnicamente, '
          + 'la capa de IA introduce <b>costo variable que KIMOS no controla</b>: si el precio del token sube, el '
          + 'margen se comprime en silencio; conviene modelar ese costo por plan antes de publicar tarifas. El cuello '
          + 'real es organizacional: 24 módulos son 24 backlogs, 24 documentaciones y 24 filas de soporte. Sin '
          + 'instrumentar la adopción por módulo y sin la disciplina de congelar o discontinuar los que no rinden, '
          + 'el producto se vuelve inmanejable mucho antes de volverse rentable.'),
        bloque('var(--ep-orange)', 'La decisión de precio, en una línea',
          'Entrar en torno al <b>' + pct(ratio) + ' del gasto actual</b> del cliente, vender kits en lugar de la '
          + 'suite completa, cobrar cada módulo en su unidad natural de valor y financiar la implementación aparte. '
          + 'Con ese esquema el ahorro anual para el cliente llega a '
          + money(Math.max(0, (M.stackTotal - cEnt.precio) * 12)) + ' y KIMOS conserva margen para sostener el '
          + 'roadmap. Lo que hundiría el modelo no es un precio mal puesto: es prometer veinticuatro productos y '
          + 'entregar veinticuatro medianías.')),
      Card('Notas del análisis', 'var(--ep-violet)',
        'Lo que escribas aquí se guarda con el estudio. Útil para dejar dicho qué se validó, con quién se negoció '
        + 'y qué supuesto hay que revisar la próxima vez.',
        h(TextEdit, {
          value: m.notas, filas: 6, placeholder: 'Escribe aquí las conclusiones de tu equipo…', aria: 'Notas del análisis',
          onCommit: setNotas,
        })));
  }

  const VISTAS = {
    resumen: vistaResumen, mapa: vistaMapa, precios: vistaPrecios, planes: vistaPlanes,
    configurador: vistaConfigurador, versus: vistaVersus, diagnostico: vistaDiagnostico,
  };

  /* ── Componente raíz ────────────────────────────────────────────────── */

  function Component() {
    const [estado, setEstado] = React.useState({ model, config });
    React.useEffect(() => {
      listeners.add(setEstado);
      return () => { listeners.delete(setEstado); };
    }, []);

    const m = estado.model;
    const cfg = estado.config;
    const M = React.useMemo(() => calcular(m), [m]);

    const ent = DATOS.planes.find((p) => p.name === 'Enterprise');
    const cEnt = precioPlan(m, M, ent);
    const ratio = M.stackTotal ? cEnt.precio / M.stackTotal : 0;
    const sano = ratio >= BANDA.min && ratio <= BANDA.max;

    const estiloRaiz = {};
    if (cfg.acento) estiloRaiz['--ep-violet'] = cfg.acento;
    if (cfg.densidad === 'compacta') estiloRaiz.fontSize = '12.5px';

    return h('div', { className: 'kimos-estudio-precios', style: estiloRaiz },
      h('header', { className: 'ep-hd' },
        h('div', { className: 'ep-brand' },
          h('div', { className: 'ep-logo', 'aria-hidden': 'true' }, 'K'),
          h('div', { style: { minWidth: 0 } },
            h('h1', { className: 'ep-tit' }, 'Estudio de Precios KIMOS',
              h('span', { className: 'ep-ver', title: 'Estudio de Precios KIMOS v' + APP_VERSION }, 'v' + APP_VERSION)),
            h('p', { className: 'ep-sub' },
              DATOS.apps.length + ' aplicaciones · ' + M.nDet + ' planes de competencia · '
              + M.nVer + ' verificados · precios de lista USD · ' + DATOS.sup.fecha))),
        h('div', { className: 'ep-acciones' },
          h('button', { type: 'button', className: 'ep-btn', onClick: exportarCSV, title: 'Descargar CSV para Excel' }, '↓ CSV'),
          h('button', { type: 'button', className: 'ep-btn', onClick: exportarJSON, title: 'Descargar el modelo completo en JSON' }, '↓ JSON'),
          h('button', {
            type: 'button', className: 'ep-btn danger', title: 'Volver a los datos originales del estudio',
            onClick: () => {
              const ok = typeof window === 'undefined' || !window.confirm
                || window.confirm('Se descartan todos los cambios y vuelven los datos originales del estudio. ¿Continuar?');
              if (ok) restablecer();
            },
          }, '↺ Restablecer'))),

      h('nav', { className: 'ep-tabs', role: 'tablist' }, TABS.map((t) => h('button', {
        key: t.id, type: 'button', role: 'tab',
        'aria-selected': m.tab === t.id ? 'true' : 'false',
        className: 'ep-tab' + (m.tab === t.id ? ' on' : ''),
        onClick: () => irA(t.id),
      }, svgIco(ICO_TAB[t.id], 'ep-tab-ico'), t.label))),

      h('main', { className: 'ep-body' },
        h('div', { className: 'ep-kpis' },
          Kpi('Gasto actual del cliente', money(M.stackTotal),
            money1(M.stackTotal / m.sup.usuarios) + ' por usuario/mes', 'var(--ep-orange)'),
          Kpi('KIMOS Enterprise', money(cEnt.precio),
            money1(cEnt.peruser) + ' por usuario/mes', 'var(--ep-violet)'),
          Kpi('KIMOS vs. gasto actual', pct(ratio),
            sano ? 'Dentro de la banda sana' : (ratio < BANDA.min ? 'Estás regalando margen' : 'Se cae el argumento de ahorro'),
            sano ? 'var(--ep-green)' : 'var(--ep-red)'),
          Kpi('Ahorro anual del cliente', money(Math.max(0, (M.stackTotal - cEnt.precio) * 12)),
            'Argumento central de venta', 'var(--ep-cyan)'),
          Kpi('Precios verificados', M.nVer + '/' + M.nDet,
            'El resto requiere validación', 'var(--ep-fuchsia)')),

        (VISTAS[m.tab] || vistaResumen)(m, M, cfg),

        h('div', { className: 'ep-foot' },
          'Estudio de mercado de agosto de 2026 · precios de lista públicos en USD, sin impuestos ni descuentos por '
          + 'volumen · conviene revalidarlo cada 6 meses · lo que edites se guarda en esta instancia de la app')));
  }

  return {
    Component,
    unmount() {
      clearTimeout(guardarT);
      listeners.clear();
      if (offAgent) { try { offAgent(); } catch (e) { /* ya desregistrado */ } }
      if (offConfig) { try { offConfig(); } catch (e) { /* ya desuscrito */ } }
    },
  };
}
