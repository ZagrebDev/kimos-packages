# 📊 Encuesta Rápida — app de EJEMPLO de terceros

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
