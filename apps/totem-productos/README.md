# Totem de Productos

Vitrina **táctil vertical (9:16)** del catálogo, pensada para un tótem de
atención al cliente y para usarse con la **app Vitrinas** (agente de voz
incrustado). Muestra los productos de las apps **Productos** (`products`) y
**ProductLab** (`productlab`), incluidos los personalizables con paso a paso.

Versión actual: **1.0.0**

## Qué hace

- **Vitrina** — grilla táctil de productos (tarjetas o lista, 1–3 columnas),
  filtros por categoría, ficha con galería, precio (con precio tachado),
  descripción, especificaciones y configuraciones sugeridas.
- **Personalización** — para productos de ProductLab (y productos de
  `products` con opciones/variantes) abre un **paso a paso touch**: opciones
  con foto/swatch, recargos por valor, dependencias entre pasos, foto que
  cambia según la selección, precio y entrega estimada en vivo, y un
  **resumen** para mostrar al equipo de la tienda (informativo: sin checkout).
- **Catálogo** — curación: qué fuentes e ítems se muestran, categoría por
  producto y orden de los destacados.
- **Estilos** — edición de la visualización con previsualización 9:16 en vivo:
  color de acento, fondo (oscuro/claro/color), **bordes rectos ↔
  redondeados**, tarjetas o lista, columnas, ajuste de fotos, tipografía,
  precios/recargos y texto del CTA. Puede respetar el estilo por producto de
  ProductLab dentro del configurador.
- **Publicación** — la vitrina pública **no tiene sesión** (no hay
  `shell.data` ni `authFetch`), así que la app publica un **snapshot** del
  catálogo curado + estilos en su item `definition`
  (`public.enabled + public.data`, permiso `public.read`). El tótem lo
  consume vía `GET /api/public/app/{instanceId}/definition`, lo refresca con
  el faro `/definition/version` y guarda una copia en `localStorage` como
  respaldo sin red.
- **Agente IA** — las respuestas **actúan en pantalla**: `MOSTRAR_PRODUCTO`,
  `FILTRAR_CATEGORIA`, `ABRIR_PERSONALIZACION`, `ELEGIR_OPCION`,
  `APLICAR_PRESET`, `VER_RESUMEN`, `VOLVER_AL_INICIO`… (mismo patrón que la
  app `evento-ciberseguridad`: `dispatchAction` reutiliza las funciones de la
  UI, la pantalla se mueve mientras el agente habla).

## Datos que lee

| Fuente | Cómo | Qué usa |
|---|---|---|
| `products` | `shell.data.listInstances/listItems` | name, sku, price, compareAtPrice, stock, imagen(es), descripción, `options[]` + `variants[]` (se convierten en pasos con recargo) |
| `productlab` | ídem; **preferente**: `definition.public.data` (JSON público v2 ya resuelto: `basePrice` + `delta` por valor + estilo) | pasos (`groups/values`), fotos por valor, presets, specs, estilo por producto |
| `productlab` sin publicar | motor de precios replicado (costo→margen→IVA→redondeo, alternativas por tipo, stock) | recargos por valor calculados localmente |

Los productos de `products` enlazados a un producto de ProductLab
(`storeRef.itemId`) se muestran una sola vez, en su versión personalizable.

## Uso en el tótem

1. En el escritorio: pestaña **Catálogo** → curar; **Estilos** → look;
   **Publicación** → *Publicar vitrina*.
2. En la app **Vitrinas** elige esta app y agrega `?catalogo={instanceId}` a
   la URL del tótem (o pega el ID una vez en la pantalla de conexión: queda
   recordado en ese equipo).
3. En modo tótem se reserva la franja inferior (`--tp-dock: 350px`) para el
   dock de voz de la vitrina, y la inactividad (⚙ configurable) vuelve al
   inicio y limpia la selección.

## Historial

| Versión | Cambios |
|---|---|
| 1.0.0 | Versión inicial: vitrina táctil 9:16, fuentes products + productlab (JSON público v2 o motor de precios local), configurador paso a paso con dependencias y foto viva, presets, pestaña Estilos con preview, publicación pública para vitrina con caché offline, agente IA con acciones en pantalla, modo tótem con zona segura para el dock de voz e inactividad. |
