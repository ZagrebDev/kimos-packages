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
  principal, tema claro/oscuro, bordes, posición (izq/der), publicado on/off
  y registro de mensajes on/off.
- **🔗 Incrustar** — dos formas de usar el agente en un sitio externo:
  1. **Widget flotante**: `<script src=".../widget.js" async></script>`
  2. **Panel fijo**: `<iframe src=".../widget?layout=panel">`

## Requisitos

- El agente vinculado debe tener `scope: "public"` en
  `enterprises/{eid}/agents/{agentId}` (igual que el chat público del Panel
  HTML). Si no lo es, el widget se muestra con el chat deshabilitado.

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
rate-limit y registro de conversaciones.

## Agente (control por el agente del escritorio)

Tools: `LIST_CONVERSATIONS`, `MARK_READ`, `DELETE_CONVERSATION`, `SET_PUBLISHED`.
