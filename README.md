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
packages/
  kimos-worldskin/         # paquete de FUENTES compartible entre apps
    src/                   # fragmentos que cada app compila en su bundle
    style/                 # decorado, con marcador %ROOT% para enclaustrarlo
    test/                  # pruebas del paquete y de su contrato
    docs/CONTRATO.md       # quién puede adoptarlo y con qué garantías
```

`packages/` **no es código en tiempo de ejecución**. Las apps de KIMOS son
bundles autónomos y no hay runtime compartido entre ellas: un paquete se
*vendoriza*, es decir, sus fuentes se concatenan dentro del bundle de cada app
que lo adopta. Así dos apps que compartan un paquete siguen sin poder romperse
entre sí.

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
| `kreative-studio` 🎬 | **Estudio de campañas publicitarias con IA**: de las fotos de un producto y una frase («crea una campaña premium») a la campaña completa — investigación, concepto, funnel, storyboard con dirección de fotografía, prompts por proveedor (OpenAI, Midjourney, FLUX, SD, ComfyUI, Runway, Kling, Veo, Sora, Higgsfield), voz y música, script FFmpeg, control de marca, copy multicanal, assets, versiones y analítica. Proveedores intercambiables y orquestación por el agente de KIMOS. Ver [`apps/kreative-studio/`](apps/kreative-studio/). |
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
