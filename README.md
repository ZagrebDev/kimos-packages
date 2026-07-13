# Kimos Packages

Repositorio de contenido instalable para Kimos Enterprise: fondos de pantalla y apps plugin que el backend descarga e instala bajo demanda.

> **¿Quieres crear tu propia app?** Empieza por **[`CREA-TU-APP.md`](CREA-TU-APP.md)**
> (guía pública paso a paso, sin necesidad de backend). La referencia técnica
> completa del contrato está en [`APP-SPEC.md`](APP-SPEC.md).

## Estructura

```
manifest.json              # índice global { version, wallpapers[], apps[] }
wallpapers/
  XX_grupo/
    full/                  # originales
    thumb/                 # miniaturas para galería
apps/
  panel-html/
    manifest.json          # { id, name, version, entry, icon, permissions, appShellApi }
    dist/
      index.js             # bundle ESM autocontenido (usa globalThis.React)
      index.css            # estilos (usa CSS vars del tema del shell)
    README.md
```

## Apps instalables

Cada app es un bundle ESM que exporta `default function mount(shell): { Component, unmount? }`.
El host (`InstalledAppHost` en kimos-enterprice) hace `await import("/api/apps/{id}/bundle.js")`,
llama `mount(shell)` y monta el componente devuelto en una ventana del shell v2.

El bundle debe:

- Usar `globalThis.React` y `globalThis.ReactDOM` (NO importarlos como dependencia) para compartir la
  instancia del shell — distintas copias de React rompen los hooks.
- Persistir su estado vía `shell.saveData(payload)` / `shell.loadData()` — el shell escribe en
  `/equipos/{teamId}/data/{instanceId}/instance.json` por debajo.
- Declarar `appShellApi: "1.x"` en `manifest.json` para que el loader rechace mismatch mayor.

Apps actualmente publicadas:

| id           | versión | descripción                                |
|--------------|---------|--------------------------------------------|
| `panel-html` | 1.0.0   | Editor de HTML embebido con vista sandbox  |

Pendientes de extracción desde el monorepo (siguiendo el patrón de `panel-html`): `kanban`, `gantt`, `editor`.

## Fondos de pantalla

`manifest.json` declara grupos en `wallpapers[]`. Cada grupo tiene `id`, `name`, `description`,
emoji opcional y lista de imágenes con `id`, `original`, `thumb`. El backend de Kimos lee este
manifest desde `raw.githubusercontent.com/.../main/manifest.json` y expone los archivos vía
`GET /api/public/packages/{groupId}/files/{name}` (sin auth, allowlist por prefijo).

## Cómo añadir una app

1. Crear `apps/{id}/` con `manifest.json`, `README.md` y `dist/index.{js,css}`.
2. Añadir entrada en la sección `apps` del `manifest.json` raíz con `id`, `name`, `version`, `icon`.
3. Commit + push a `main`. Tras el deploy, la app aparece en la Tienda de Front 2.0 como "Disponible".
4. El usuario admin la instala desde la Tienda → backend descarga `dist/` a GCS bajo `/apps/{id}/{version}/`.
