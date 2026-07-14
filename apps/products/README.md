# Productos (bundle oficial)

Catálogo de productos para KIMOS. Reemplaza a la app nativa del producto
(v1.x) siendo **100 % compatible con sus datos**: mismos items
(`{id, name, sku, price, stock, status, description, imageUrl, variants[],
entityIds[], sourceLinks[], syncStatus, extra}`) y misma config de instancia
(`{viewMode, enabledEntityTypeIds, extraFields, integrationBindings, …}`).
El bundle solo modifica las claves de config que gestiona y preserva el
resto (p. ej. `allowedUserIds`, `dataSources`) en cada guardado.

## Funciones

- Vistas **tabla** y **grid** (persistida en `config.viewMode`).
- Búsqueda + filtros por estado (activo/borrador/inactivo) y por atributos.
- Editor: SKU, precio, stock, imagen, descripción, marca, código de barras,
  precio tachado (`compareAtPrice`), costo (`costPerItem`), peso, campos
  personalizados (`config.extraFields`) y atributos del workspace.
- **Opciones del producto** (v2.1, `item.options`): definiciones con nombre,
  tipo (`option` | `addon` con recargo | `custom`), orden y valores. El
  backend las sincroniza con los endpoints dedicados del API oficial
  (`/products/{id}/options.json` y `.../values.json`): crea, actualiza,
  reordena y **elimina** en Jumpseller lo que se quite en Kimos.
- **Variantes** con opciones (`Color: Negro, Talla: M`) y precio, stock,
  SKU, código de barras, precio tachado y costo **propios por variante**.
  Las variantes eliminadas localmente se **eliminan también en Jumpseller**
  en el siguiente push (poda).
- **Jumpseller** (vía `shell.authFetch`):
  - Vincular la instancia (`config.integrationBindings`).
  - Importar catálogo (`POST /api/integrations/jumpseller/sync-to-apps`).
  - Pull manual (`POST …/items/sync-pull`) — trae también opciones,
    variantes extendidas y campos de comercio (Jumpseller es la fuente de
    verdad para productos enlazados).
  - Push global y por producto (`POST …/items/sync-push`): crea en
    Jumpseller los productos locales sin enlace y actualiza los enlazados
    (producto → opciones/valores → variantes, en ese orden); badges
    `↑ JS / ○ pend. / ↑ Error` según `syncStatus`.
- **Agente IA** (`shell.agent.register`, activo con la ventana abierta):
  `UPSERT_PRODUCT`, `DELETE_PRODUCT`, `ASSIGN_ENTITY`, `SET_FILTER`,
  `SYNC_PULL`, `SYNC_PUSH`.

## Notas de migración

- `2.0.0` sustituye a la entrada nativa `1.0.0`: al actualizar desde la
  Tienda, el tenant pasa a servir este bundle y el lanzador deja de usar el
  componente del shell.
- Las fuentes de datos genéricas (`config.dataSources`) y el control de
  acceso por usuario (`config.allowedUserIds`) se conservan en la config
  pero no tienen UI en el bundle todavía.
