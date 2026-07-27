# ProductLab en cualquier tienda Jumpseller

Guía para adaptar ProductLab a **cualquier** tienda Jumpseller (no solo la
original de la herencia). Cubre requisitos, instalación, puntos de
acoplamiento del theme y operación diaria.

---

## 1. Requisitos previos

| Pieza | Requisito |
|---|---|
| KIMOS (kimos-enterprice) | Backend jul-2026+ (persistencia de `permissions` en installs de registry, gateway público, AR GLB). Desplegado con setup-kimos. |
| App **Productos** v2.1+ | Instalada, con credenciales Jumpseller cargadas en Integraciones (login + authtoken), instancia vinculada y catálogo importado (`sync-to-apps`). |
| Usuario operador | Escritura en el equipo dueño de la instancia de Productos (el push usa su RBAC vía `shell.authFetch`). |
| Theme Jumpseller | Cualquier theme con las dependencias de §3 (Streamly funciona tal cual; otros requieren adaptar el add-to-cart). |

## 2. Instalación paso a paso

1. **Instalar ProductLab** (Tienda KIMOS → ProductLab → Instalar; o sideload
   `.kapp` con `node tools/pack.mjs apps/productlab`). Aprobar permisos:
   `public.read` (JSON del configurador) y `data.read:products` (catálogo).
2. **Crear una instancia** (una por tienda). Verificar en el header:
   `PRODUCTOS · N EN CATÁLOGO`.
3. **Pestaña Precios**: base del margen, IVA %, USD→CLP, margen por defecto y
   por tipo, redondeos (final 990 / millar / ninguno; recargos), días de
   preparación, alerta de verificación. **Renombrar/crear los tipos de
   componente según el dominio de la tienda** (muebles, indumentaria, equipos…).
4. **Componentes**: cargar insumos con costo de proveedor + link, stock,
   entrega y compatibilidades (o importarlos desde la tienda).
5. **Productos**: enlazar producto de la tienda → base → pasos (valores
   genéricos con alternativas, cantidades, neutros y dependencias) → ficha
   (builder + estilo + visualizador 3D) → **Guardar y aplicar a la tienda**.
   El custom field `diseno=personalizado` se asegura automáticamente.
6. **Publicación**: publicar el JSON y copiar la **URL pública**.
7. **Theme**: instalar el kit `theme/` (ver `theme/INSTALL.md`):
   `assets/configurador.js`, `assets/configurador.css`, la rama personalizada
   de `components/product-template.liquid`, la opción `kimos_url` en
   `components/product-template.json`, el badge de `partials/product_block.liquid`
   y las opciones de `config/options.json`/`settings.json`.
   **Probar primero en un theme duplicado.**
8. **Editor visual** → página de producto → componente Template → pegar la URL
   pública en "URL del configurador KIMOS" (alternativa:
   `window.PP_KIMOS_URL` en `assets/custom.js`).
9. Prueba end-to-end: elegir valores → precio = variante → carro → checkout;
   verificar dependencias (pasos que aparecen/desaparecen), fotos por color y
   entrega estimada.

## 3. Puntos de acoplamiento del theme anfitrión

El kit asume estas capacidades (Streamly las tiene; verifícalas al portar):

1. **`product.fields`** en Liquid — interruptor `diseno=personalizado`.
2. **`{{ product | json }}`** en `<script class="product-json">` con forma
   `[{variant:{…}, values:[{value:{id,name}}]}]` — fuente del precio real.
3. **Selects `.prod-options`** con `data-optionid`/`data-optionname` — el JS
   del theme (`Jumpseller.productVariantListener`) hace matching de variante y
   add-to-cart AJAX. **Punto de acoplamiento más fuerte**: en un theme sin
   este contrato hay que reimplementar la selección de variante (adaptador).
4. **`<product-form>`** + `.product-form__input/__handler/__actions` +
   `button#add-to-cart` (custom element de Streamly).
5. **Header** con `position: fixed|sticky` que matchee
   `header, .theme-header, #header` — la barra fija se calcula por JS.
6. Filtro Liquid **`| resize`** para fotos.
7. Bundle de color del theme (`--color-links`, `--color-main`,
   `--color-background`…) — el CSS del kit los consume con fallback ProductLab;
   `storefront.style` del producto los puede sobreescribir por producto.

## 4. Multi-tienda con un solo KIMOS

- **Una instancia de ProductLab por tienda** (documento propio): cada una con
  sus reglas de precio, componentes, productos y URL pública independiente.
- La app Productos define a qué tienda Jumpseller se pushea (credenciales de
  la integración del tenant). Para atender varias tiendas Jumpseller desde un
  mismo tenant se requiere una integración por tienda (hoy: 1 tenant = 1
  tienda Jumpseller; multi-integración es evolución del backend).
- El theme kit es por-tienda: se instala en el theme de cada una apuntando a
  la URL pública de su instancia.

## 5. Operación diaria

- Verificar proveedores (pestaña Componentes, filtro "por verificar") →
  Precios → **Recalcular productos y sincronizar**.
- Stock 0 en agotados (o stock = unidades; los valores con `qty` exigen stock
  suficiente). La elegibilidad la controla la app; el stock del
  producto/variante de Jumpseller se maneja en su admin.
- Cambios de ficha/estilo/3D: solo guardar — la republicación es automática
  (visible en tienda en ≤5-8 min por las caches).
- No editar opciones/variantes de productos aplicados en el admin de
  Jumpseller: la próxima aplicación las regenera (poda incluida).

## 6. Problemas típicos

| Síntoma | Causa probable |
|---|---|
| Configurador no aparece | Falta custom field `diseno=personalizado`, o la URL del configurador no está en el editor visual. |
| 403 al leer la definición | Publicación desactivada, o la app se instaló por registry con un backend sin el parche de `permissions` (usar sideload o actualizar backend). |
| `PRODUCTOS · SIN ACCESO` | Permiso `data.read:products` no aprobado o instancia de Productos no visible para tu equipo. |
| Precio del carro ≠ mostrado | Variante desalineada: re-aplicar el producto. Ese caso **no debe existir** (el precio es la variante). |
| Paso dependiente cobra oculto | Su default no es neutro — la app lo advierte en el editor. |
| Cambios no se ven en la tienda | Caches en cadena (≤5-8 min); `?_t` fuerza recarga. |
