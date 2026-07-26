# 📬 Formularios de Contacto

App instalable **multiInstance** para crear formularios de contacto incrustables
en cualquier sitio web externo y gestionar los mensajes recibidos desde KIMOS.

Cada **instancia** (documento) es un formulario independiente con su propio
código de incrustación.

## Pestañas

- **📥 Mensajes** — bandeja de entrada de los envíos recibidos: leer, marcar
  no leído, archivar, eliminar. Se refresca automáticamente cada 30 s.
- **🛠️ Diseño** — editor del formulario: título, descripción, botón, mensaje de
  éxito, email de notificación (requiere SMTP del enterprise configurado),
  publicado on/off, editor de campos (texto, email, teléfono, texto largo,
  selección; requerido; orden) y **Apariencia del widget** con vista previa en
  tiempo real: base claro/oscuro, colores de fondo / texto / inputs / botón y
  resaltado / bordes / texto de los modales de éxito y error, borde (con/sin,
  ancho, esquinas rectas o redondeadas) y tamaño de texto.
- **🔗 Incrustar** — tres formas de usar el formulario en un sitio externo:
  1. **Script**: `<div data-kimos-contact-form="ID"></div><script src=".../embed.js" async></script>`
  2. **iframe**: `<iframe src=".../embed">` — el snippet trae la altura inicial
     calculada según los campos y un `<script>` opcional que la auto-ajusta vía
     `postMessage` (`kimos-contact-form:height`), sin scrollbars internos.
  3. **API**: `POST /api/public/contact-forms/{ID}/submissions` desde un
     formulario propio con diseño a medida (ej. sitio FIGIT).

El widget muestra el resultado del envío (éxito o error) en un **modal
superpuesto** sobre el formulario: el alto no cambia al enviar, por lo que el
iframe mantiene una altura fija.

## Modelo de datos

Items de la instancia (`enterprises/{eid}/apps/{instanceId}/items`):

- `definition` — definición del formulario (`kind: "definition"`). La lee el
  backend público para validar y renderizar el widget.
- `{uuid}` — mensajes recibidos (`kind: "submission"`, `status: new|read|archived`),
  escritos por el endpoint público del backend.

## Backend requerido

`kimos-enterprice/backend/contactFormsAPI.py` (rutas públicas
`/api/public/contact-forms/{instanceId}/…`): definición pública, recepción de
envíos (validación por definición, honeypot, rate-limit, notificación email
best-effort), widget `embed.js` y página `embed`.

## Agente

Tools: `LIST_MESSAGES`, `MARK_READ`, `DELETE_MESSAGE`, `SET_PUBLISHED`.
