# ProductLab multi-plataforma — Jumpseller hoy, Shopify y WooCommerce mañana

Cómo está aislada la integración actual y el plan concreto para integrar
otras plataformas de ecommerce sin tocar el corazón de la app.

---

## 1. Qué es agnóstico y qué es específico hoy

ProductLab ya separa responsabilidades en tres capas:

| Capa | Contenido | ¿Depende de Jumpseller? |
|---|---|---|
| **Núcleo** (app) | Componentes, costos, márgenes, pasos (qty/neutros/dependencias), ficha, estilo, model3d, precios | **No** — es puro modelo de datos + reglas |
| **Publicación** | JSON público `/definition` (presentación) + visor 3D + AR | **No** — lo consume cualquier frontend |
| **Aplicación a la tienda** | `applyToStore()`: escribe `price + options[] + variants[]` en el item de la app **Productos** y dispara su `sync-push` | **Sí** — el push del backend habla con Jumpseller |

El único punto donde ProductLab "conoce" al ecommerce es `applyToStore()` y
la lectura del catálogo (`shell.data.listInstances('products')`). La app
Productos + el backend hacen de **adaptador**: ProductLab nunca llama a la API
de Jumpseller directamente.

En el otro extremo, el **theme kit** (`theme/`) sí es específico del theme
anfitrión (hoy Streamly/Jumpseller): sus puntos de acoplamiento están
enumerados en `docs/JUMPSELLER.md` §3.

## 2. El contrato conceptual que toda plataforma debe cumplir

Para portar ProductLab, la plataforma destino debe poder expresar:

1. **Producto** con precio base actualizable por API.
2. **Opciones** nombradas con valores nombrados (un paso = una opción).
3. **Variantes por combinación con precio absoluto** — la pieza clave: el
   cobro real nunca se calcula en el navegador.
4. **Metadato de activación** en el template de producto (custom field /
   metafield / meta) para encender la vista personalizada.
5. **Un lugar donde inyectar el configurador** (theme editable o storefront
   custom) que pueda leer el JSON público de KIMOS.

## 3. Plan Shopify

- **Modelo**: `options` (máx 3) + `variants` con precio propio → igual que
  hoy. Límite duro: **100 variantes/producto** (Shopify) vs 400 actuales →
  la app ya avisa por umbral; hacer el límite configurable por integración.
  Con >3 pasos u >100 combos: usar la estrategia *line item properties* +
  Shopify Functions/Scripts para el precio, o dividir productos.
- **Backend**: nuevo módulo `integrations/shopify_sync.py` espejo de
  `jumpseller_sync.py` (Admin GraphQL API: `productSet`,
  `productVariantsBulkUpdate`, metafields para `diseno=personalizado`).
- **App Productos**: generalizar `sourceLinks[].integration` (`'shopify'`) y
  el binding de instancia por integración. `_push_item_to_integrations` ya
  itera integraciones — agregar la rama shopify.
- **Storefront**: theme app extension / bloque Liquid que monte
  `configurador.js` (el kit ya parametriza locale/moneda y lee
  `productos||equipos`); adaptar el add-to-cart al AJAX de Shopify
  (`/cart/add.js`) — está aislado en `syncNativeSelects()` + el bloque
  `product-form` (crear `themeAdapter` por plataforma).
- **ProductLab (app)**: casi sin cambios — solo mostrar la integración del
  producto enlazado y el límite de variantes por plataforma.

## 4. Plan WooCommerce (WordPress)

- **Modelo**: producto variable + atributos (opciones) + variaciones con
  precio propio (REST API `wp-json/wc/v3`: `products`,
  `products/<id>/variations` en batch). Sin límite duro de 100, pero >200
  variaciones degrada el admin → mantener el umbral de 400 con aviso.
- **Backend**: `integrations/woocommerce_sync.py` (auth por consumer
  key/secret). Metadato de activación: `meta_data` del producto.
- **Storefront**: plugin WP ligero (shortcode/bloque) que encole
  `configurador.js` + CSS en la página de producto y exponga el
  `product-json` equivalente (variaciones) — o render server-side del
  formulario variable nativo + el configurador encima (misma técnica de
  selects nativos ocultos: Woo usa `<select>` de atributos, el matching es
  directo).
- **Visor 3D y AR**: sin cambios (leen el JSON público de KIMOS).

## 5. Refactor recomendado al abrir la segunda plataforma

1. **`ThemeAdapter`** en el theme kit: aislar en un objeto único
   `{findVariant, setSelection, addToCart, getMinPrice}` los 4 puntos que hoy
   asumen Streamly (documentados en JUMPSELLER.md §3).
2. **Límite de variantes por integración** en `rules` (Jumpseller 400,
   Shopify 100, Woo 400).
3. **`store` y `currency` del JSON público** ya existen: agregar
   `integration: 'jumpseller'|'shopify'|'woocommerce'` por producto enlazado
   para que el theme sepa qué adaptador usar.
4. Mantener la invariante: **el precio cobrable vive en la plataforma**
   (variante/variación); el JSON público es presentación. Es lo que hace que
   el carro nunca mienta, en cualquier plataforma.

## 6. Estado

- [x] Jumpseller — producción (herencia computadores, generalizada).
- [ ] Shopify — pendiente (plan §3).
- [ ] WooCommerce — pendiente (plan §4).
