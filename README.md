# Kimos Packages

Repositorio de contenido instalable para Kimos Enterprise: fondos de pantalla y apps plugin que el backend descarga e instala bajo demanda.

> **¿Quieres crear tu propia app?** Empieza por **[`CREA-TU-APP.md`](CREA-TU-APP.md)**
> (guía paso a paso, sin necesidad de backend). La referencia técnica completa
> del contrato está en [`APP-SPEC.md`](APP-SPEC.md). Para terceros SIN acceso a
> este repo existe **`kimos-creator-pack.zip`** (guía + empaquetador + ejemplos),
> descargable desde la Tienda de KIMOS o regenerable con
> `node tools/build-creator-pack.mjs`.

## Modelo de apps (v0.22)

| Nivel | Distribución | Ejemplos |
|---|---|---|
| **Sistema** | Incluidas siempre (shell) | Archivos, Configuración, Tienda, Apariencia, Vitrina |
| **Oficial** | Instalable desde esta Tienda. Las `runtime: "native"` viven en el producto y al instalarlas solo se HABILITAN (sin descarga de bundle); las demás descargan su `dist/`. **Desinstaladas por defecto.** | Kanban, Planificación, Panel HTML, Productos, Pedidos, Clientes (nativas) · Formularios de Contacto, Agentes Web, Notas, FossFLOW (bundle) |
| **Externa** | Archivo `.kapp` (Tienda → Instalar desde archivo) con el creator pack | miorg.encuestas, miorg.buzon |

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

Apps actualmente publicadas (la fuente de verdad es el array `apps[]` del
`manifest.json` raíz):

| id              | descripción breve |
|-----------------|-------------------|
| `productlab` 🧪 | **Laboratorio de productos personalizables**: componentes/costos, pasos con dependencias y cantidades, previsualizador, builder de descripción, visualizador 3D/AR y publicación del configurador (Jumpseller). Ver [`apps/productlab/`](apps/productlab/). |
| `estudio-mercado` 🎯 | **Estudio del mercado competitivo**: los 24 módulos de KIMOS contra 154 planes de precio de la competencia, precio sugerido, planes y kits, mercado por país, unit economics y decisiones cruzadas. Todos los supuestos son editables y se recalcula en vivo. Ver [`apps/estudio-mercado/`](apps/estudio-mercado/). |
| `kanban` · `gantt` · `products` · `orders` · `customers` · `contact-forms` · `web-agents` · `notas-equipo` · `fossflow` | Ver sus carpetas en `apps/` y el manifest raíz. |

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

## Cómo actualizar una app publicada (versionado)

**La Tienda ofrece la actualización según el `manifest.json` RAÍZ**, no según el
de la carpeta de la app. Si solo se sube uno de los dos, la app instalada se
queda con el bundle viejo y no aparece nada que actualizar. En cada publicación,
en el mismo commit, la versión sube en **cuatro** lugares:

| # | Dónde | Para qué |
|---|---|---|
| 1 | `apps/{id}/manifest.json` → `version` | Fuente de verdad de la app (y del `.kapp`). |
| 2 | **`manifest.json` raíz** → `apps[] → {id}.version` | **Lo que lee la Tienda**: sin esto no hay actualización. Sube también `description` si cambió. |
| 3 | `apps/{id}/dist/index.js` → `const APP_VERSION` | La versión que la app **muestra en pantalla** (chip `vX.Y.Z` en su cabecera), para confirmar qué build tomó el host al probar. |
| 4 | `apps/{id}/README.md` | “Versión actual” + tabla de historial con qué trae cada versión. |

Antes de commitear, verificar (falla con código 1 si algo quedó desalineado):

```bash
node tools/check-versions.mjs                # todas las apps
node tools/check-versions.mjs notas-equipo   # una sola
```

Semver: parche para arreglos, menor para funciones nuevas compatibles, mayor si
cambia el formato de datos o el contrato del agente. **Nunca reutilizar un
número ya publicado**: el backend guarda y cachea el bundle en
`/apps/{id}/{version}/`, así que repetir versión sirve el bundle viejo.
Referencia completa en [`APP-SPEC.md` §7.a](APP-SPEC.md); `apps/notas-equipo` es
el ejemplo con la versión a la vista en la cabecera.
