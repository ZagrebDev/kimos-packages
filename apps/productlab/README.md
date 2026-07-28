# ProductLab 🧪

**Laboratorio de productos personalizables para la tienda — app oficial de
KIMOS** (`apps/productlab`, v2.1.0). Gestiona componentes/insumos y costos
reales, arma productos configurables paso a paso, calcula precios con reglas
parametrizables, muestra el producto en un **visor 3D con AR**, y publica todo
hacia el ecommerce: precio + opciones + **variantes por combinación** (vía la
app Productos → Jumpseller) y el JSON público que alimenta el configurador del
theme.

> **Herencia (continuidad del proyecto).** ProductLab 2.0.0 es la unión de las
> dos líneas de desarrollo paralelas:
> - Base: **"Gestión Avanzada de Productos" v1.13.2** (repo `personalizador`,
>   rama `claude/generic-product-management-3d-q8zewx`) — la generalización de
>   la app de computadores con modos de precio, multimoneda, visor 3D nativo y
>   cadena AR completa. **Todo su código y conocimiento están aquí.**
> - Paridad verificada con **`hubpro.computadores` v3.6.1** (repo
>   `computadores`): gestion-productos ya era superset de sus funcionalidades.
> - Más las mejoras nuevas de ProductLab (abajo). Detalle completo en
>   `docs/ARQUITECTURA.md`.

## Qué hace

- **Componentes** — insumos de cualquier rubro (telas, tableros, piezas, mano
  de obra, procesos externalizados) con costo de proveedor multimoneda (mapa
  FX), impuesto de importación %, stock, días de entrega, link de verificación
  y compatibilidades (`tags`/`requires`/`excludes`). Presets de tipos por rubro.
- **Productos** — enlazados a la app Productos/Jumpseller:
  - **Modos de precio**: `auto` (desde costos + margen), `fixed` (a mano,
    exacto) o `store` (el de la tienda). Guardia de precio cero.
  - **Pasos** con valores genéricos y pool de alternativas (siempre la más
    económica disponible), valores **sin costo**, **recargos** (`priceDelta`),
    **cantidades** (`qty` — "2×8" con el mismo componente, ProductLab 2.0) y
    **pasos dependientes** (`dependsOn` — un paso aparece según lo elegido en
    un paso anterior, ProductLab 2.0).
  - **Previsualizador en vivo** del paso a paso como lo verá el cliente
    (dependencias, precios por modo, entrega, estilo — ProductLab 2.0).
  - **Visor 3D opcional** (motor propio `assets/engine3d.js`, three.js
    vanilla): partes y acabados del GLB, efectos por valor (color / acabado /
    ocultar pieza), generación de pasos desde el modelo, y **AR**: Scene
    Viewer (Android, GLB parcheado con la configuración), Quick Look (iPhone,
    USDZ generado en el navegador con la textura horneada), QR de escritorio a
    móvil y AR en vivo opcional (8th Wall).
  - **Ficha de tienda**: builder de descripción por secciones (12 patrones de
    hero, 10 tipos de bloque incluida la descripción viva de la tienda,
    **secciones de imagen con alto adaptable a la foto** y tamaños `auto` —
    ProductLab 2.0), specs, fotos, nota, pestañas, y **estilo del configurador
    por producto** (acento, fondo, radio, cards, precios en cards, colapsado —
    ProductLab 2.0).
- **Precios** — moneda base/símbolo/decimales/locale, monedas de costo con FX,
  impuesto de venta con nombre (IVA/VAT/IGV), márgenes por tipo con base sobre
  costo o sobre venta, 4 modos de redondeo, plazos, alerta de verificación.
- **Publicación** — JSON público del configurador
  (`GET /api/public/app/{instanceId}/definition`, contrato **version 2**) con
  republicación automática; marca (`brandName`), tienda, URL base y custom
  field parametrizable.
- **Datos** — migración desde otro catálogo (p. ej. la app de computadores)
  preservando ids, y exportación/importación: **CSV de componentes** editable
  en planilla (ida y vuelta) y JSON del catálogo completo (respaldo o traslado
  a otro proyecto). Ver `docs/MIGRACION.md`.
- **Agente IA** — 20 tools con snapshot completo, contrato embebido
  (`builderRef`), alias en español, errores didácticos y sincronía con el
  editor abierto (banner de conflicto).

## Instalación

1. **Tienda KIMOS** → ProductLab → Instalar (requiere backend jul-2026+ con
   persistencia de `permissions` y `assets` en installs de registry), o
   sideload: `node tools/pack.mjs apps/productlab` → "Instalar desde archivo".
2. Requiere app **Productos v2.1+** con credenciales Jumpseller y catálogo
   importado. Crear una instancia de ProductLab por tienda.
3. **Theme**: kit en `theme/` — se integra **sin editar liquid** (se engancha
   a `.prod-options` desde `assets/custom.js`): ver `theme/README.md` y
   `docs/JUMPSELLER.md`.
4. 3D/AR: ver `docs/VISUALIZADOR.md` y los packs de ejemplo en `packs/`.

## Tools del agente (20)

`UPSERT_COMPONENT` · `SET_COMPONENT_COST` · `SET_MARGIN` · `SET_STOCK` ·
`RECALC_PRICES` · `UPSERT_PRODUCTO` (con `priceMode`/`fixedPrice`) ·
`SET_PRODUCTO_STEPS` (valores con `qty`, `priceDelta`, `dependsOn`, efectos
3D, alias en español) · `COMPOSE_HERO` · `SET_STOREFRONT` (pageSections con
secciones `imagen`, `style` por producto, validación estricta + anti-borrado)
· `LINK_PRODUCT` · `APPLY_PRODUCTO` · `PUBLISH_CONFIG` · `IMPORT_IMAGE` ·
`SET_MODEL3D` · `BUILD_3D_STEPS` (genera pasos desde el modelo 3D) ·
`LIST_SOURCES` · `MIGRATE_FROM` (migra otro catálogo aquí) · `EXPORT_DATA` ·
`IMPORT_DATA` (CSV o JSON, por URL o inline).

## Estructura

```
apps/productlab/
├─ manifest.json          # + entrada en el manifest.json raíz (en sync)
├─ dist/index.js          # bundle ESM legible (fuente = dist)
├─ dist/index.css
├─ assets/engine3d.js     # motor 3D (three.js vanilla, carga diferida)
├─ engine-src/            # fuente del motor (esbuild: npm run build:engine)
├─ theme/                 # kit Jumpseller sin tocar liquid (+ AR + tests)
├─ packs/mesa-hanoi/      # pack de ejemplo (model3d.json + pasos.json)
├─ docs/                  # ARQUITECTURA · MIGRACION · JUMPSELLER · PLATAFORMAS · VISUALIZADOR
└─ test/test-app.mjs      # smoke test completo offline (node test/test-app.mjs)
```

## Verificar antes de publicar

```bash
node apps/productlab/test/test-app.mjs     # smoke test completo (obligatorio)
node tools/pack.mjs apps/productlab        # .kapp para sideload
```

Un **bump de `version`** (manifest de la app **y** raíz, en sync) + merge a
`main` propaga la nueva versión; para el motor 3D, `npm run build:engine`
desde `apps/productlab/` regenera `assets/engine3d.js`.
