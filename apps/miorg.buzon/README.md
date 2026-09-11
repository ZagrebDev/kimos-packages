# 📮 Buzón de Sugerencias — app de EJEMPLO de terceros (superficie mínima)

**Versión actual: 1.0.1**

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

## Avisos del revisor descartados, y por qué

`node tools/check-app.mjs` señala que esta app **no aparece en el catálogo raíz**.
Es deliberado: es un ejemplo de app de TERCEROS, no una app oficial del
producto, así que no se ofrece desde la Tienda. Se instala con
«Instalar desde archivo» a partir de su `.kapp`.

Queda escrito aquí a propósito: un aviso descartado con motivo es una
decisión; uno descartado en silencio es el que vuelve dentro de seis meses
(ver `ALINEA-TU-APP.md`).
