# 📮 Buzón de Sugerencias — app de EJEMPLO de terceros (superficie mínima)

El ejemplo **más pequeño posible** de app de terceros con ingreso público:
solo declara `public.submit` en el manifest (ni siquiera `public.read` — la
definición no se expone públicamente).

## Qué demuestra

- **Permiso mínimo**: `permissions: ["instance.read", "instance.write", "public.submit"]`.
- El widget (`assets/embed.js`, servido como asset público) es estático: sus
  textos vienen de atributos `data-*` del script y solo postea a
  `POST /api/public/app/{id}/submit/sugerencia`.
- La app opt-in con `definition.public = { enabled: true, channels: ["sugerencia"] }`
  (toggle Publicado en la cabecera) y lee las sugerencias con `shell.items`.

Contrasta con `miorg.encuestas`, que además usa `public.read` para que su
widget lea la configuración de la encuesta.

Empaquetar: `node tools/pack.mjs apps/miorg.buzon`
