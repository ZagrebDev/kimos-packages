# Migrar a ProductLab y mover datos (export / import)

Cómo traer un catálogo existente (por ejemplo la app **Computadores HubPro**
o **Gestión Avanzada de Productos**) a ProductLab, y cómo sacar y volver a
meter datos — sobre todo **componentes**, que es lo más costoso de cargar a
mano.

Todo vive en la pestaña **Datos** de la app (y en tools del agente, §5).

---

## 1. Migración directa desde otra app (recomendada)

**Pestaña Datos → Migrar → "Buscar catálogos disponibles"** → elegir la
instancia de origen → *Analizar origen* → *Migrar a este catálogo*.

Qué hace:

- Lee la instancia elegida con **tus** permisos (RBAC del usuario; solo
  aparecen instancias a las que ya tienes acceso).
- Traduce el esquema de la app de origen al de ProductLab:
  `kind: "equipo"` → `producto`, `productRef` → `storeRef`, reglas antiguas
  (`ivaPct`, `usdRate`, `assemblyDays`, `roundMode: end990/up1000`) → las
  nuevas (`salesTaxPct`, `fx.USD`, `leadTimeDays`, `ending`/`up`), y las
  formas viejas de pasos (`groups[].componentIds`) → valores con alternativas.
- **Conserva los identificadores**: los pasos siguen apuntando a sus
  componentes y no hay que re-enlazar nada.
- Trae también los **tipos de componente** del origen (cpu, ram, tela…), así
  la clasificación no se pierde.
- Es **idempotente**: repetirla actualiza lo existente (match por id, si no
  por nombre) en vez de duplicar.

Opciones:

| Opción | Cuándo desmarcarla |
|---|---|
| Traer reglas de precio y tipos | Si ya configuraste márgenes/moneda aquí y no quieres que los pise el origen. |
| Traer productos | Si solo te interesa el catálogo de componentes. |
| Mantener enlaces con la tienda | **Desmárcala si migras a otro proyecto/tenant**: allí esas instancias de la app Productos no existen y habría que re-enlazar igual. |
| No tocar lo que ya existe | Para una segunda pasada que solo agregue lo que falta. |

Después de migrar, revisa en cada producto: el enlace con la tienda
("Producto de la tienda"), el modo de precio y los avisos del editor; luego
**Guardar y aplicar a la tienda** cuando quieras publicar.

## 2. Componentes en CSV (ida y vuelta)

**Datos → Exportar → "Componentes (CSV)"** descarga una planilla con una fila
por componente. Se edita en Excel/Sheets y vuelve con **Importar**.

Columnas (el encabezado manda; el orden no importa, y sobran/faltan sin
romper):

```
id, nombre, tipo, marca, specs, costo, moneda, impuestoPct, stock,
diasEntrega, proveedor, urlProveedor, verificadoEn, aporta, requiere,
incompatibleCon, activo, imagenUrl, notas
```

- **`id`**: si viene, se actualiza ese componente. Si lo dejas vacío, se crea
  uno nuevo (o se actualiza el que tenga el mismo `nombre`).
- **`tipo`**: acepta el id (`ram`) o la etiqueta (`Memoria RAM`). **Si el tipo
  no existe, se crea solo** con la etiqueta que escribiste.
- **`stock`** vacío = sin control de stock; `0` = no elegible.
- **`aporta` / `requiere` / `incompatibleCon`**: listas separadas por coma
  (compatibilidades).
- **`activo`**: `si`/`no`.
- Los costos aceptan `1.234.567` o `1234567`.

Casos típicos: subir costos de todo un proveedor de una vez, cargar 200
insumos nuevos desde la planilla del proveedor, o corregir masivamente días de
entrega. Tras importar, **Precios → Recalcular productos y sincronizar**.

## 3. JSON (respaldo y traslado entre proyectos)

- **"Componentes + reglas (JSON)"**: catálogo de insumos y parámetros de
  precio.
- **"Todo el catálogo (JSON)"**: además, los productos con sus pasos, ficha,
  estilo y 3D — con los enlaces a la tienda.
- **"Todo, portable (sin enlaces)"**: lo mismo **sin** `storeRef`/`lastPush`,
  para llevarlo a otro proyecto o tenant donde esos enlaces no existen (allí
  se re-enlaza cada producto con "Enlazar producto…").

Se importan con **Datos → Importar → Elegir archivo**.

## 4. Qué NO viaja

- Los **productos de la tienda** (Jumpseller) y sus opciones/variantes: viven
  en la app Productos y en la tienda. ProductLab los vuelve a escribir cuando
  aplicas cada producto.
- Las **imágenes** están por URL: si apuntan al File Storage de otro proyecto,
  súbelas de nuevo allí (o usa `IMPORT_IMAGE`).
- El **JSON público** del configurador se regenera solo al publicar.
- Los `.glb` del visor 3D: son URLs; en otro proyecto hay que volver a
  subirlos y actualizar `model3d.url`.

## 5. Con el agente (chat)

| Tool | Para qué |
|---|---|
| `LIST_SOURCES` | Lista los catálogos (instancias) desde los que puedes migrar, con su id. |
| `MIGRATE_FROM` | `{origen, dryRun?, rules?, productos?, keepStoreLinks?, mode?}` — migra (con `dryRun: true` solo informa cuánto hay). |
| `EXPORT_DATA` | `{formato: "json"\|"csv"}` — exporta y devuelve la URL del archivo. |
| `IMPORT_DATA` | `{url}` o `{datos}` — importa desde una URL (JSON o CSV) o un paquete inline. |

Ejemplos de lo que puedes pedirle:

> «Migra los datos de la app de computadores a este catálogo» → el agente
> llama `LIST_SOURCES`, encuentra la instancia y ejecuta `MIGRATE_FROM`.

> «Exporta los componentes a CSV» → `EXPORT_DATA {formato:"csv"}` y te
> devuelve el link para abrirlo en la planilla.

## 6. Recomendación de orden

1. Exporta primero un respaldo del catálogo actual (JSON completo) si ya
   tenías datos aquí.
2. Migra desde el origen con *Analizar* → *Migrar*.
3. Revisa Precios (moneda, impuesto, redondeo) y la pestaña Componentes.
4. Revisa cada producto (enlace con la tienda, modo de precio, avisos).
5. Publica y aplica a la tienda cuando esté todo conforme.
