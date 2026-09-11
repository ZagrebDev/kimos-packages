# 📊 Encuesta Rápida — app de EJEMPLO de terceros

**Versión actual: 1.0.1**

Demuestra cómo un desarrollador externo construye una app **con endpoints
públicos sin escribir backend**: todo pasa por el gateway genérico de la
plataforma, habilitado por los `permissions` del manifest.

## Qué demuestra

| Pieza | Patrón |
|---|---|
| `manifest.json` | `permissions: ["public.read", "public.submit"]` — el superadmin los ve al instalar el `.kapp`. |
| `dist/index.js` | Guarda la encuesta en `items/definition` con el bloque `public` (`enabled`, `channels: ["respuesta"]`, `data`). Lee las respuestas con `shell.items` (llegan como `kind: "submission"`). |
| `assets/embed.js` | Widget incrustable servido como **asset público** (`/api/apps/miorg.encuestas/asset/embed.js`). Lee `GET /api/public/app/{id}/definition` y postea a `POST .../submit/respuesta`. |

## Uso

1. Instalar el `.kapp` (Tienda → Instalar desde archivo, superadmin).
2. Crear un documento (cada uno es una encuesta) → pestaña Diseño → publicar.
3. Copiar el snippet de la pestaña Incrustar en cualquier web.
4. Los resultados aparecen en la pestaña Resultados (conteo por opción +
   respuestas individuales).

Empaquetar: `node tools/pack.mjs apps/miorg.encuestas`

## Avisos del revisor descartados, y por qué

`node tools/check-app.mjs` señala que esta app **no aparece en el catálogo raíz**.
Es deliberado: es un ejemplo de app de TERCEROS, no una app oficial del
producto, así que no se ofrece desde la Tienda. Se instala con
«Instalar desde archivo» a partir de su `.kapp`.

Queda escrito aquí a propósito: un aviso descartado con motivo es una
decisión; uno descartado en silencio es el que vuelve dentro de seis meses
(ver `ALINEA-TU-APP.md`).
