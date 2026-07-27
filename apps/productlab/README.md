# ProductLab 🧪

**Laboratorio de productos personalizables para la tienda.** App oficial de
KIMOS (`apps/productlab`). Gestiona el catálogo de componentes/insumos, arma
productos configurables con pasos, calcula precios desde los costos y publica
todo hacia el ecommerce: precio + opciones + variantes por combinación (vía la
app Productos → Jumpseller) y el JSON público que alimenta el configurador del
theme y el visualizador 3D.

> **Herencia.** ProductLab es la evolución **generalizada** de dos apps:
> `hubpro.computadores` (repo `computadores`, v3.6.1 — toda su funcionalidad
> está incluida) y el `Personalizador 3D` (repo `personalizador` — hoy
> "ProductLab Visualizador"). Sin dominio fijo: sirve para muebles, equipos,
> indumentaria o cualquier producto configurable. Cuando antes se hablaba de
> "equipos" ahora son **productos**; cuando se hablaba de "veta" ahora es
> **textura**. La continuidad completa está en `docs/ARQUITECTURA.md`.

---

## Qué hace

- **Componentes** (pestaña Componentes): catálogo de insumos con costo de
  proveedor (CLP/USD + impuesto de importación %), link de verificación,
  stock, días de entrega y compatibilidades (`tags` / `requires` / `excludes`).
  Verificación rápida por fila, acciones masivas e importación desde el
  catálogo de la tienda.
- **Productos** (pestaña Productos): cada producto enlaza un producto real de
  la app Productos (y por ella, de Jumpseller) y define:
  - **Base**: componentes siempre incluidos + costos adicionales manuales.
  - **Pasos**: valores genéricos que ve el cliente ("Roble natural"), cada uno
    con un pool de componentes alternativos — siempre se usa el más económico
    **disponible**. Novedades ProductLab:
    - **Cantidad por valor** (`qty`): un valor puede incluir N unidades del
      componente elegido (ej. "16GB (2×8)" = 2 módulos; exige stock ≥ N).
    - **Valores neutros** (`neutral`): opción válida de $0 sin componentes
      ("Sin accesorio") — se marca explícitamente.
    - **Pasos dependientes** (`dependsOn`): un paso se muestra solo si un paso
      anterior tiene elegido cierto valor (ej. "Tarjeta de video" solo con la
      placa que la admite). Oculto = se usa su default (idealmente neutro).
    - **Previsualizador en vivo**: el paso a paso tal como lo verá el cliente
      (interactivo: dependencias, precios, entrega, estilo), escritorio y móvil.
  - **Ficha de tienda**: builder de descripción por secciones (heros con 12
    patrones y 9 tipos de bloque, **secciones de imagen con alto adaptable a la
    foto**, sección de visor 3D, especificaciones, fotos, nota), pestañas de la
    barra, **estilo del configurador** (acento, fondo, radio de esquinas,
    presentación de cards, precios en cards, pasos colapsados) y **visualizador
    3D** (visor embebible + GLB + partes/texturas + AR).
- **Precios** (pestaña Precios): base del margen (sobre costo o sobre venta),
  IVA %, tipo de cambio, margen por tipo de componente, redondeos, días de
  preparación, alerta de verificación, y recálculo global con sincronización.
- **Publicación** (pestaña Publicación): publica el JSON del configurador
  (`GET /api/public/app/{instanceId}/definition`) y se **republica solo** en
  cada guardado. Inspección del JSON y del payload de opciones/variantes.
- **Agente IA**: cobertura completa por tools (ver más abajo) con snapshot
  rico, contrato embebido (`builderRef`) y errores didácticos.

## Instalación

1. **Tienda KIMOS** → instalar **ProductLab** (esta app) y aprobar permisos.
   Requiere backend kimos-enterprice con persistencia de `permissions` en
   installs de registry (parche jul-2026) — alternativamente instalar el
   `.kapp` (sideload): `node tools/pack.mjs apps/productlab`.
2. Requiere la app **Productos v2.1+** con credenciales Jumpseller y catálogo
   importado (el push a la tienda existe solo para instancias de `products`).
3. Crear **una instancia** por tienda. El header debe decir
   `PRODUCTOS · N EN CATÁLOGO` (si dice `SIN ACCESO`, falta `data.read:products`).
4. Theme: instalar el kit de `theme/` en el theme Jumpseller
   (ver `theme/INSTALL.md` y `docs/JUMPSELLER.md`).
5. Visualizador 3D (opcional): desplegar el visor del repo `personalizador`
   ("ProductLab Visualizador") y configurar su URL por producto
   (ver `docs/VISUALIZADOR.md`).

## Motor de precios

```
venta(componente) = redondeo( margen( costoCLP × (1+impuesto%) ) × (1+IVA%) )
margen 'cost' (markup): venta = costo × (1 + m%)     [m% por tipo]
margen 'sale':          venta = costo ÷ (1 − m%)
precio(combinación) = redondeoFinal( base + Σ valor elegido de cada paso )
valor = qty × alternativa más económica DISPONIBLE (activa, stock ≥ qty)
```
El precio cobrable **siempre** es la **variante Jumpseller** (precio absoluto
por combinación, generado por "Aplicar a la tienda"); el JSON público es solo
presentación. Límites: aviso >150 variantes, bloqueo >400.

## Tools del agente

| Tool | Qué hace |
|---|---|
| `UPSERT_COMPONENT` | Crea/actualiza componente por nombre (costo, moneda, impuesto %, stock, tags…) |
| `SET_COMPONENT_COST` | Actualiza costo y marca verificado hoy |
| `SET_MARGIN` | Margen % por tipo (o `default` / `base`) |
| `SET_STOCK` | Stock individual o masivo |
| `RECALC_PRICES` | Recalcula todos los productos; `apply` re-aplica y republica |
| `UPSERT_PRODUCTO` | Datos básicos del producto (sku, entrega, modo de entrega) |
| `SET_PRODUCTO_STEPS` | Reemplaza pasos: valores con `qty`, `neutral`, `dependsOn` |
| `SET_STOREFRONT` | Builder (`pageSections` con hero/imagen/visor3d/specs/fotos/note), specs, nota, tabs y `style` |
| `COMPOSE_HERO` | Compone un hero desde campos planos (preferida para heros) |
| `SET_MODEL3D` | Visualizador 3D: visor, GLB, AR, paso vinculado, config de partes/texturas |
| `LINK_PRODUCT` | Enlaza a un producto de la app Productos |
| `APPLY_PRODUCTO` | Escribe precio + opciones + variantes en la tienda |
| `PUBLISH_CONFIG` | Publica/despublica el JSON del configurador |
| `IMPORT_IMAGE` | Importa una imagen (adjunto del chat / URL) al área pública |

El snapshot expone el estado completo (componentes, productos con pasos y
ficha, `builderRef` con el contrato exacto del builder) y todos los errores
listan los valores válidos para que el agente se autocorrija.

## Estructura

```
apps/productlab/
├─ manifest.json          # + entrada en el manifest.json raíz del repo
├─ dist/index.js          # bundle ESM legible (fuente = dist, sin build)
├─ dist/index.css
├─ theme/                 # kit para themes Jumpseller (configurador + liquid + harness)
├─ docs/                  # ARQUITECTURA · JUMPSELLER · PLATAFORMAS · VISUALIZADOR
└─ test/test-app.mjs      # smoke test completo (node test/test-app.mjs)
```

## Verificar antes de publicar

```bash
node --input-type=module -e "import('./apps/productlab/dist/index.js').then(m=>console.log(typeof m.default))"
node apps/productlab/test/test-app.mjs      # smoke test completo
node tools/pack.mjs apps/productlab         # genera el .kapp (sideload)
```

Un **bump de `version`** (en ambos manifests, app y raíz) + merge a `main` es
lo que propaga una nueva versión a las tiendas.
