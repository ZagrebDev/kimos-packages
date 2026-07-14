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
- Editor: SKU, precio, stock, imagen, descripción, **variantes** con
  opciones (`Color: Negro, Talla: M`) y precio/stock/SKU propios, campos
  personalizados (`config.extraFields`) y atributos del workspace.
- **Jumpseller** (vía `shell.authFetch`):
  - Vincular la instancia (`config.integrationBindings`).
  - Importar catálogo (`POST /api/integrations/jumpseller/sync-to-apps`).
  - Pull manual (`POST …/items/sync-pull`).
  - Push global y por producto (`POST …/items/sync-push`): crea en
    Jumpseller los productos locales sin enlace y actualiza los enlazados;
    badges `↑ JS / ○ pend. / ↑ Error` según `syncStatus`.
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
