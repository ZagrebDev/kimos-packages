# 🤖 Agentes Web

App instalable **multiInstance** para crear agentes de chat incrustables en
cualquier sitio web externo (el mismo widget flotante estilo Intercom que
ofrecía el Panel HTML, pero gestionado desde una app dedicada, sin panel) y
llevar el registro de las conversaciones recibidas.

Cada **instancia** (documento) es un agente web independiente con su propio
código de incrustación.

## Pestañas

- **💬 Conversaciones** — registro de las conversaciones del widget, agrupadas
  por visitante: transcripción completa (burbujas usuario/agente), leído /
  no leído, eliminar. Se refresca automáticamente cada 30 s.
- **🛠️ Diseño** — agente vinculado (selector desde `/api/identity/agents`),
  nombre a mostrar, mensaje de bienvenida, saludo junto a la burbuja, color
  principal, tema claro/oscuro, colores de fondo y superficie del chat
  (auto según tema o personalizados), bordes, posición (izq/der), publicado
  on/off, registro de mensajes on/off y **vista previa en vivo** del widget
  (el diseño guardado, recargada en cada guardado). Además (v1.4):
  - **Privacidad y transparencia**: la conversación persiste solo mientras
    el visitante navega/recarga; tras `historyTtlHours` de inactividad
    (default 4 h, 0 = nunca) se ELIMINA por completo — transcript local y
    memoria del agente (se rota el visitorId) — y la próxima visita arranca
    limpia, sin ninguna referencia a conversaciones anteriores. Aviso de
    transparencia al inicio del chat, antes del primer mensaje
    (`disclaimer`), y botón permanente ⟳ "Iniciar nueva conversación" en el
    encabezado.
  - **Proactividad**: mensaje automático junto a la burbuja tras N segundos
    en la página (`proactiveText`, `proactiveSeconds`, filtro opcional
    `proactiveUrlContains`, una vez por pestaña).
  - **Ventas / tarjetas de producto**: instancia de la app **Productos**
    vinculada (`productsInstanceId`) — el backend inyecta al agente el
    producto de la página actual + coincidencias del catálogo real
    (anti-alucinación) y resuelve el marcador `[[cards: id…]]` a tarjetas
    con imagen, precio, stock y botones "Ver producto" / "Añadir al
    carrito" (`storeBaseUrl`, `cartUrlTemplate` con `{id}`, `{variant_id}`,
    `{sku}`, `{url}`).
  - **Derivación a humano**: instancia de la app **Formularios de contacto**
    vinculada (`contactFormId`, `contactLabel`) — el formulario (campos,
    éxito, notificación email) se administra en esa app; el widget lo
    muestra dentro del chat cuando el agente emite `[[contacto]]` (no puede
    resolver, frustración, pide un humano) y siempre desde el botón 👤 del
    encabezado. Los envíos llegan a la bandeja de esa app.
- **🔗 Incrustar** — dos formas de usar el agente en un sitio externo:
  1. **Widget flotante**: `<script src=".../widget.js" async></script>`
  2. **Panel fijo**: `<iframe src=".../widget?layout=panel">`

## Requisitos

- El agente vinculado debe tener `scope: "public"` en
  `enterprises/{eid}/agents/{agentId}` (igual que el chat público del Panel
  HTML). Si no lo es, el widget se muestra con el chat deshabilitado.
- Los selectores de instancias vinculadas (Productos / Formularios de
  contacto) usan `shell.data.listInstances(...)`, que exige los permisos
  `data.read:products` y `data.read:contact-forms` del manifest **instalado**:
  tras actualizar la app hay que reinstalarla/actualizarla para que el
  backend los reconozca. Sin ellos, los campos aceptan el id a mano.
- El formulario de derivación usa los endpoints públicos de contact-forms
  (`/definition` + `/submissions`): la instancia vinculada debe estar
  **publicada** en su app y sin `restrictDomains` (o con el dominio de KIMOS
  verificado), porque el POST sale desde el iframe del widget (origen KIMOS).

## Modelo de datos

Items de la instancia (`enterprises/{eid}/apps/{instanceId}/items`):

- `definition` — definición del widget (`kind: "definition"`). La lee el
  backend público para renderizar el widget y autorizar el chat.
- `conv_{visitorId}` — conversaciones registradas (`kind: "conversation"`,
  `status: new|read`, `messages: [{role, text, at}]`, máx. 200 mensajes),
  escritas por el endpoint público en cada turno de chat.

## Backend requerido

`kimos-enterprice/backend/webAgentsAPI.py` (rutas públicas
`/api/public/web-agents/{instanceId}/…`): widget embebible (reutiliza el
template y theming del widget del Panel HTML), loader `widget.js` con
posición configurable, y chat público con validación de agente público,
rate-limit y registro de conversaciones. El chat responde
`{mensaje, cards?, contact?}`: inyecta por turno la URL que navega el
visitante + el catálogo real de la instancia de Productos vinculada
(cacheado 120 s) y resuelve los marcadores `[[cards: …]]` / `[[contacto]]`
que emite el agente.

## Agente (control por el agente del escritorio)

Tools: `LIST_CONVERSATIONS`, `MARK_READ`, `DELETE_CONVERSATION`, `SET_PUBLISHED`.
