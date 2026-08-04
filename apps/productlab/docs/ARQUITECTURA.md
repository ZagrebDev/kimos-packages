# ProductLab — Arquitectura, herencia y funcionamiento (v3.0.0)

Documento de continuidad: todo lo necesario para seguir desarrollando
ProductLab sin perder el conocimiento adquirido en sus tres antecesores.

---

## 1. Linaje (qué viene de dónde)

```
computadores (hubpro.computadores v3.6.1)          personalizador
  pasos/valores/alternativas, precios,               visor 3D R3F (Vite) +
  builder, COMPOSE_HERO, agentes robustos,           pipeline de modelos
  Jumpseller (options/variants/custom fields)              │
        │                                                  │
        └──► gestion-productos v1.13.2 (rama claude/generic-product-management-3d-…
             del repo personalizador) — "la app personalizador":
             generalización TOTAL (rubro/moneda/impuesto/redondeo por parámetro),
             priceMode auto/fixed/store, recargos, valores sin costo,
             visor 3D nativo (engine3d, three vanilla) con efectos por valor,
             BUILD_3D_STEPS, cadena AR completa (Scene Viewer + USDZ en el
             navegador + QR + 8th Wall), theme sin tocar liquid, sincronía
             agente↔editor, bloque description, hero de arranque
                    │
                    └──► ProductLab 2.0.0 (ESTA app, kimos-packages/apps/productlab)
                         = gestion-productos 1.13.2 (base, íntegra) + mejoras:
                         · pasos DEPENDIENTES (dependsOn)
                         · CANTIDAD por valor (qty; stock exigido ×qty)
                         · secciones de IMAGEN de alto adaptable + tamaños auto
                         · ESTILO del configurador por producto (style)
                         · PREVISUALIZADOR en vivo del paso a paso
                         · aviso de 150 variantes reactivado, blockSchema
                           completo (description) y curaduría final de marca
```

La paridad gestion-productos ⊇ computadores v3.6.1 fue verificada feature por
feature (única excepción: el aviso de 150 variantes, reactivado aquí). El
visor 3D standalone del repo personalizador (Vite/R3F, main) queda como
**visor independiente opcional**; el visor integrado de la app y del theme es
`assets/engine3d.js` (mismo núcleo `engine-src/` para ambos anfitriones).

## 2. Mapa del ecosistema

```
┌───────────────────┐  storeRef      ┌──────────────────┐   sync-push   ┌────────────┐
│ ProductLab        │ ─────────────► │ app products     │ ────────────► │ Jumpseller │
│ (componentes,     │  PUT item:     │ (item producto)  │  backend      │  producto  │
│  costos, márgenes,│  price +       │                  │  KIMOS        │  opciones  │
│  pasos, ficha,    │  options[] +   │                  │               │  variantes │
│  3D/AR)           │  variants[]    │                  │               │  cust.field│
└─────────┬─────────┘                └──────────────────┘               └──────┬─────┘
          │ publica JSON público (public.read, republicación automática)       │
          ▼                                                                    ▼
GET /api/public/app/{instanceId}/definition ◄── theme/custom.js ─► kimos-configurador.js
          │                                        (sin tocar liquid)  + kimos3d.js (3D)
          ├──► AR Android: GET …/ar/{ref}.glb?m=Material:hex  (glb_materials del backend)
          └──► AR iPhone: USDZ generado EN el navegador (engine3d.exportUSDZ)
```

Los 4 hechos de diseño heredados siguen vigentes: (1) el push a Jumpseller
solo existe para instancias del template `products` (ProductLab escribe a
través de ellas con `shell.authFetch` + RBAC); (2) el precio cobrable es
SIEMPRE la variante (nunca se calcula en el navegador); (3) la API de
Jumpseller no tiene CORS (todo pasa por el backend); (4) la presentación viaja
en el JSON público.

## 3. Modelo de datos (items de la instancia)

### `definition` (singleton)
`types[]` (presets por rubro: genérico/confección/mobiliario/computación, y
propios), `rules` (`currency`+`currencySymbol`+`currencyDecimals`+`locale`,
`fx{}` monedas de costo, `salesTaxLabel`+`salesTaxPct`, `marginBasis`
cost/sale + `marginDefaultPct` + `marginBasePct` + `marginByType`,
`roundMode` none/nearest/up/ending + `roundTo` + `roundEnding`,
`deltaRoundTo`, `leadTimeDays`, `staleDays`), `brandName`, `storeName`,
`storeBaseUrl`, `storeCustomField {name,value}` (parametrizable; vacío = no se
envía), `styleTemplates[] {id, name, style}` + `styleDefaultId` (plantillas de
estilo del catálogo: un look completo reutilizable en muchos productos),
`public {enabled, data}`. Alias legacy aceptados en lectura: `ivaPct`,
`usdRate`, `assemblyDays`, `end990`/`up1000`.

### `component`
`{name, type, brand, specs, imageUrl, currency (validada contra fx), cost,
taxPct (se suma al costo antes del margen), supplierName, supplierUrl,
verifiedAt, deliveryDays, stock (null = sin control), storeRef?, tags[],
requires[], excludes[], active, notes}`.

### `producto`
`{name, sku, status, storeUrl, storeRef{instanceId,itemId,sourceId,sku,name,
imageUrl}, priceMode (auto|fixed|store), fixedPrice, deliveryMode (max|sum),
deliveryExtraDays, baseComponentIds[], extraCosts[], groups[], model3d,
storefront{}, galleryImages[], price, lastPush{}}`.

**`groups[]` (pasos) — con las novedades ProductLab:**
```jsonc
{
  "id": "grp-…", "typeId": "material", "label": "Cubierta",
  "photoStep": false,                  // su selección cambia la foto (swatches)
  "dependsOn": {                       // NUEVO: paso condicional
    "stepId": "grp-anterior",          //   solo un paso ANTERIOR (sin ciclos)
    "valueIds": ["val-roble"]          //   visible solo si la selección está aquí
  },
  "defaultValueId": "val-roble",
  "values": [{
    "id": "val-…", "label": "Roble",
    "qty": 1,                          // NUEVO: unidades del componente (precio ×qty, stock ≥ qty)
    "priceDelta": 0,                   // recargo manual de venta (herencia GP)
    "imageUrl": "", "swatchColor": "",
    "componentIds": ["cmp-a", "cmp-b"],// pool de alternativas ([] = valor sin costo)
    "model3d": [{ "partId": "superficie", "type": "finish", "finishId": "roble" }]
  }]
}
```
Semántica: un valor con `componentIds: []` es una **opción sin costo** (válida
y publicada; cobra con `priceDelta` si quieres). El default de un paso
dependiente debe ser sin costo — la app lo advierte si no (se cobraría
oculto). Las variantes siguen siendo el cartesiano completo (Jumpseller exige
un valor por opción); el theme fuerza el default de los pasos ocultos en los
selects nativos.

**`model3d`** (visor 3D opcional): `{enabled, url (GLB), rotation, mirror,
publish, realSizeCm (0 = sin AR), arUrl (GLB a escala real para Scene
Viewer), parts[{id,label,materials[],defaultColor,defaultFinish,roughness,
grainVertical,grainAngle,grainAlongMaterials}], finishes[{id,label,color,
texture,roughness,textureScale,grain,opacity,triplanar,plySpacing}]}`.

**`storefront`**: `pageSections[]` (builder: heros con 12 patrones y 10 tipos
de bloque incluido `description`; secciones fijas `specs`/`fotos`/`note`; y
**NUEVO** `{kind:'imagen', imageUrl, alt, width:'content'|'full', link}` —
repetible, alto adaptado a la foto), `specs[]`, `photosNote`, `tabs{}`,
`heroSeeded`, `style{accentColor,bgColor,radius,cardStyle,showDeltas,
stepsCollapsed,width,bar{},photos{}}` (estilo del configurador por producto) y
`styleId` (**2.5**: `''` = lo que diga el catálogo · `'own'` = el `style` de
arriba · `<id>` = una plantilla de `definition.styleTemplates`). Bloques
`photo`/`gallery` y la altura del hero aceptan `'auto'` (alto natural).

**Dónde se edita (2.6).** El aspecto vive en la pestaña **Estilos** (plantillas
del catálogo, con previsualizador); en el producto solo se elige cuál aplicar,
y el editor completo aparece únicamente si el producto lleva estilo propio. El
formulario es un único componente (`StyleEditor`) usado en ambos sitios.

**Campos del estilo (2.8).** Además de colores, radio, anchos, barra y fotos,
`style.buyLabel` fija el texto del botón que lleva al configurador; vive en el
estilo para cambiarlo de una vez en toda una plantilla, y `storefront.tabs.comprar`
lo pisa por producto.

**Estilo efectivo.** `resolveStyle(producto)` decide qué rige — la plantilla
elegida, la del catálogo o el estilo propio — y **el JSON público viaja ya
resuelto**: el theme recibe un `storefront.style` plano y no sabe que existen
plantillas. Una plantilla se aplica entera (es un look completo, no una mezcla
campo a campo); el producto se desengancha copiándola a su estilo propio.

## 4. Motor de precios

```
venta(componente) = redondeoRecargos( margen( costoBase × (1+taxPct%) ) × (1+salesTaxPct%) )
costoBase = costo × fx[moneda] (moneda sin tasa → se trata como base, no se inventa)
margen 'cost': ×(1+m%) · margen 'sale': ÷(1−m%), por tipo
valor = alternativa más económica DISPONIBLE (stock ≥ qty) × qty + priceDelta
precio(auto)        = redondeoFinal( base + Σ valor default de cada paso )
precio(fixed|store) = exacto (sin redondeo); cada combinación = base + Σ (valor − default del paso)
```
Guardias: precio ≤ 0 no se aplica a la tienda (diagnóstico por modo);
aviso > 150 variantes, bloqueo > 400; el modo `store` nunca colapsa a 0 si el
catálogo no cargó.

## 5. JSON público (contrato version 2)

`GET {KIMOS}/api/public/app/{instanceId}/definition` → `{instanceId, data}`.
Claves de `data`: `version: 2`, `currency`, `store`, `productos[]` (el theme
acepta también `equipos` legacy) con: `sku`, `productId`, `name`, `basePrice`,
`deliveryDays`, `leadTimeDays` (+ alias `assemblyDays`), `deliveryMode`,
`baseDeliveryDays`, `imageUrl`, `images[]` (galería viva), `description`
(HTML vivo de la tienda), `storefront` **íntegro** (con `style` ya RESUELTO
—plantilla del catálogo o propio— y las secciones `imagen`), `model3d` (solo si `enabled && publish`; incluye `arUrl`
y `realSizeCm`), y `groups[]` con `dependsOn {groupId,valueIds}` (**NUEVO**) y
values con `qty` (**NUEVO**), `priceDelta` implícito en `delta`, `desc`,
`swatchColor`, `imageUrl`, `deliveryDays`, `tags/requires/excludes`,
`isDefault`, `model3d[]` (efectos). Un paso sin valores disponibles no se
publica; un valor sin stock suficiente para su `qty` se excluye.

## 6. Visor 3D y AR (conocimiento crítico heredado)

- `engine-src/engine3d.js` → esbuild → `assets/engine3d.js` (app, ESM,
  **carga diferida**: sin producto 3D three.js nunca se descarga) y
  `theme/kimos-engine3d.js` (IIFE `KimosEngine3D` para el theme).
- API `createViewer(canvas)`: `setModel/setParts/setFinishes/setState
  ({colors,finishes,hidden})`, `materialNames()`, `snapshot()`, `exportGLB`,
  `exportUSDZ`, `startAR`, `startLiveAR`, `dispose`. Claves de recarga
  separadas (geometría/partes/acabados/estado): tocar un color NO re-descarga
  el GLB.
- **USDZ**: sin escalas negativas (el mirror se hornea en vértices); la
  orientación de caras se MIDE contra las normales; la proyección triplanar se
  **hornea a UV** (sin esto la textura se pierde en iPhone). **Scene Viewer**:
  GLB parcheado por el backend (`/ar/{ref}.glb?m=Material:hex,…`,
  `glb_materials.py`) usando `model3d.arUrl`; el href se recalcula en
  pointerdown para llevar la configuración del momento. **QR** de escritorio a
  móvil (`qrMatrix` propio). **8th Wall** opcional (`KIMOS_XR8_URL`; binario
  bajo licencia revocable de Niantic, exige atribución). `realSizeCm` es
  requisito duro para cualquier AR.

## 7. Theme (sin tocar liquid)

`theme/custom.js` (el theme ya lo carga) + `KIMOS_3D_URL` (definition) +
`KIMOS_FULL`: `true` = ficha completa KIMOS (`kimos-configurador.js`);
`false` = solo botón "Ver en 3D" (`kimos3d.js`). El precio y el carro son
SIEMPRE del theme: la ficha escribe en los `.prod-options` nativos y pulsa el
botón real. Gotchas heredados: Jumpseller minifica/renombra assets (custom.js
deduce nombres), cache-busting con `?kv=` propio, velo anti-parpadeo con
auto-retirada, `diagnostico.js` para revisar la cadena completa. El kit v5
suma: dependsOn (con forzado de defaults en selects nativos), style por
producto, secciones imagen, tamaños auto y qty.

**Anclajes (v5.3, aprendido en tienda).** La barra y el panel de compra van
con `position: fixed` calculado, NUNCA con `sticky`: basta un ancestro con
`overflow` para que sticky se vaya con el scroll. Y si algún ancestro crea
bloque contenedor (transform/filter/perspective/will-change/contain), `fixed`
también se rompe: en ese caso la barra se muda a `<body>` dentro de un
anfitrión que copia el estilo de la ficha. El tope se mide del header del
sitio (`header, .theme-header, #header`), no del elemento fijo más bajo:
cualquier envoltorio pegajoso empujaba la barra centímetros hacia abajo.

**Configurar = computadores.** Pasos a la izquierda; a la derecha el panel con
foto (o visor 3D), precio copiado del theme, entrega calculada
(`deliveryMode` suma o paraleliza), resumen y carro. En móvil, barra flotante
desplegable.

## 8. Agentes

Todo lo heredado sigue: tools con inputSchema completos ([APP_CAPS]),
snapshot con `builderRef` (contrato del builder con `sectionShape`,
`blockSchema` —ahora completo, incluye `description`—, `example`, `heights`
con `auto`, `extraSections: ['imagen']`), COMPOSE_HERO de campos planos,
validación estricta + anti-borrado + errores didácticos que listan valores
válidos, alias de payload y de pasos en español, payload como string JSON, y
**sincronía agente↔editor abierto** (`agentEdit` + `decidirRecarga`: recarga
sola o pregunta con banner). SET_PRODUCTO_STEPS acepta además `qty`/`cantidad`
y `dependsOn {step, values}` por labels; SET_STOREFRONT acepta `style`,
`styleId` y secciones `imagen`.

**Plantillas de estilo (2.5).** `SET_STYLE_TEMPLATE` (crear/editar, con `from`
para copiar el estilo de un producto y `setDefault` para que rija en todo el
catálogo), `DELETE_STYLE_TEMPLATE` y `APPLY_STYLE_TEMPLATE` (`producto` o
`all:true`; `template` acepta id, nombre, `own` o `catalog`). El snapshot
expone `styleTemplates[]`, `styleDefaultId` y, por producto,
`storefront.styleId` + `styleEffective` + `styleSource`.

## 8.b Datos: migración y export/import (2.1)

`shell.authFetch` permite leer **otra instancia** con el RBAC del usuario
(`GET /api/app-instances` y `…/{id}/items`), y el backend **respeta el `id`**
al crear items (`POST /items` usa `body.id`) — por eso la migración conserva
los identificadores y los pasos siguen apuntando a sus componentes sin
re-enlazar. `normalizeRules()` (extraída de `rules()`) traduce los alias
históricos del origen antes de fusionar. Formato de intercambio
`kimos.productlab.data` (definition + components + productos) y CSV de
componentes con encabezado tolerante (coma o punto y coma, ids opcionales,
tipos creados al vuelo). Detalle operativo en `docs/MIGRACION.md`.

## 9. Decisiones ProductLab 2.0 (nuevas)

| Decisión | Motivo |
|---|---|
| Base = gestion-productos (no computadores) | Es superset verificado de computadores v3.6.1 y contiene el visor 3D + AR + genericidad total. |
| `qty` a nivel de valor | "2×8" y "2×16" con el mismo pool; stock exigido por cantidad. |
| dependsOn con variantes cartesianas completas | Jumpseller exige un valor por opción por variante; el theme fuerza el default oculto (que debe ser sin costo — la app avisa). |
| Valores sin costo implícitos (semántica GP, sin flag) | Diseño heredado deliberado; el borrado de componentes en uso está bloqueado, así que no hay riesgo de "gratis por accidente". |
| Secciones `imagen` + tamaños `auto` | Las alturas fijas recortaban descripciones hechas de fotos apiladas. |
| `style` por producto además del acento global (⚙️) | El acento de ⚙️ Configurar es de la APP; `style` personaliza el configurador de CADA producto en la tienda. |
| Parche backend: `permissions` + `assets` en installs de registry | Sin ellos, una app oficial no podía usar el gateway público ni servir `engine3d.js`. |
| JSON v2 con fallback v1 en el theme | Migración suave de instalaciones gestion-productos/hubpro. |
| Migración preservando ids (no regenerarlos) | Los pasos referencian componentes por id: regenerarlos obligaría a re-armar cada producto a mano. |
| Import idempotente (match por id, luego por nombre) | Permite repetir la migración sin duplicar y usar el CSV como fuente de actualización masiva. |

## 9.a Solo se publican las combinaciones ALCANZABLES (2.12)

**El problema.** Publicar el producto cartesiano de todos los pasos genera
variantes que nadie puede comprar. Con "Plataforma (AMD/Intel)" + "CPU AMD" +
"CPU Intel", el cartesiano es 2×3×3 = 18 y solo 4 existen de verdad: las otras
14 son «Intel × un procesador AMD» y similares. Jumpseller las crea, las
guarda y las recorre en cada carga de ficha — es lo que arrastra la tienda y lo
que reventó al aplicar un catálogo real.

**La solución.** `enumerarCombos(eq)` recorre los pasos EN ORDEN llevando la
selección parcial (las dependencias solo apuntan hacia atrás, así que al llegar
a un paso ya se sabe si se ve):

- paso **visible** → una rama por cada valor elegible (los `fallback` no lo son);
- paso **oculto** → UNA sola rama, con su valor de relleno.

De ahí salen las variantes que se publican y el conteo de `comboCount`. Las
que ya estaban de más en la tienda se borran solas al reaplicar: el push va con
`prune=True`. `comboCartesiano(eq)` se conserva solo para poder decir cuántas
se está ahorrando (la app lo muestra y el snapshot lo expone en
`variantCombosSinDependencias`).

El tope `MAX_COMBOS` pasa a medir lo que de verdad se publica, así que encadenar
pasos con dependencias deja de ser un lujo: es la manera de que un catálogo
grande quepa.

## 9.a.2 Compatibilidad por tags y valores CONJUNTO (2.13)

**Tags que filtran variantes.** `enumerarCombos` descarta también las
combinaciones cuyo set de componentes viola un `incompatible con` (siempre) o
un `requiere` (solo si el tag lo aporta algún componente del producto: un
`requiere` de un tag que no existe en ningún lado es configuración incompleta y
se queda en aviso, no vacía el catálogo). Etiquetar bien es la alternativa a
los pasos dependientes: "RAM DDR5 requiere plataforma:amd" mata solas las
combinaciones Intel×DDR5, sin `dependsOn` ni rellenos.

**Valores conjunto (`bundle: true`), regla por TIPO (2.14).** En un valor
conjunto los componentes se agrupan por tipo: componentes del **mismo tipo son
alternativas entre sí** (se usa el más barato disponible, como en un valor
normal) y **tipos distintos se suman**. Así "Pack extra → teclado + mouse"
lleva sus alternativas de teclado y de mouse en el mismo valor; si un tipo se
queda sin stock, el conjunto entero deja de estar disponible. Entrega = el más
lento de lo sumado; foto/specs = el primer componente. En la UI es el
interruptor «conjunto (suman)» del valor; el agente lo pasa como
`bundle`/`conjunto`.

**Tags con chips y buscador (2.14).** Los campos aporta/requiere/incompatible
muestran lo ya puesto como chips (✕ quita) y un buscador con sugerencias de los
tags usados en el catálogo (Enter o clic agrega) — el error típico era la
ortografía ("plataforma:amd" vs "plataforma: AMD"). El picker de componentes de
cada valor usa el mismo patrón: chips de lo elegido + buscador sobre todo el
catálogo, navegación por tipo (`tipo:` o los chips de tipos) con stock y precio
a la vista, y aviso «⚠ incompatible con…» contra los tags de lo ya elegido.

## 9.b Pasos dependientes: comodín automático e invisible (2.14, antes 2.10)

Jumpseller exige **un valor de cada opción en cada variante**: no existe la
combinación "sin este paso". Por eso un paso oculto por `dependsOn` sigue
aportando un valor a la variante — y si ese valor cuesta, el cliente pagaría
algo que no ve. No es un caso raro: es lo que pasa al modelar "Procesador AMD"
/ "Procesador Intel" dependientes de la placa.

Desde 2.14 esto **se gestiona solo y no aparece en la UI**: todo paso con
`dependsOn` recibe un comodín sintético "No aplica" (`comodinDe(g)`: id
`na::<grupo>`, sin componentes, sin recargo, `fallback: true`) que se inyecta
al enumerar combos, al aplicar a la tienda y al publicar el JSON. El gestor
define solo los valores reales; los conceptos "solo relleno" / "añadir default
sin costo" desaparecieron del editor (los valores `fallback` creados a mano en
instalaciones viejas se siguen respetando y evitan el sintético).

Comportamiento del comodín (igual que el `fallback` manual de 2.10):

- **sostiene** las combinaciones en las que el paso está oculto y entra en la
  matriz de variantes con precio 0 para ese paso;
- **no se pinta** como opción en la ficha ni en el previsualizador, y el
  precio calculado ignora los pasos ocultos;
- si el paso pasa a ser visible con el comodín elegido, la selección **salta
  sola y en silencio** al primer valor real (en la tienda, escribiendo en el
  select nativo — sin carteles al cliente).

`SET_PRODUCTO_STEPS` sigue aceptando `fallback` (alias `relleno`) por valor.

## 9.c Cuando la tienda no responde (2.10)

Las escrituras a la tienda pasan por la caché de Jumpseller (Varnish), que ante
una subida larga corta con `503 Timed out while waiting`. El PUT del producto y
el `sync-push` se reintentan solos (3 intentos, espera 1,2 s → 2,4 s) y la
respuesta HTML de la caché se traduce a un mensaje legible en vez de volcarse
en pantalla. Cuantas más combinaciones tenga el producto, más fácil es toparse
con ese corte: es el argumento práctico para no pasarse de variantes.

En la otra dirección — cuando el que no responde es KIMOS — la tienda no se
resiente: el kit cachea el JSON público en `localStorage` (TTL 60 s, copia
vieja si el fetch falla) y el precio y el carro vienen siempre del theme, así
que la compra nunca depende de que KIMOS esté arriba (ver README del theme).

## 10. Deuda conocida y roadmap corto

- Stock por variante en Jumpseller y detalle de la alternativa interna en el
  pedido (pendientes heredados #4/#6 de computadores).
- `opacity`/`plySpacing` de acabados y `roughness` por parte: sin UI (solo vía
  SET_MODEL3D).
- Días hábiles L-V sin feriados.
- Tests de theme con Chromium requieren copiar assets a `theme/test/` (ver su
  `.gitignore`); `verify.mjs`/`build-pack2.mjs` de los packs referencian rutas
  del repo original.
- Multi-tienda por tenant = una instancia por tienda; multi-integración de
  credenciales es evolución del backend.
- Integraciones futuras (Shopify/WooCommerce): `docs/PLATAFORMAS.md`.

## 11. Cómo publicar una nueva versión

1. Editar `dist/index.js` (fuente = dist, ESM legible, `globalThis.React`,
   sin JSX). Motor 3D: editar `engine-src/` y `npm run build:engine` (+
   `build:engine:theme` para el theme).
2. `node test/test-app.mjs` — SIEMPRE (ha cazado todos los bugs históricos).
3. Bump de `version` en ambos manifests (app y raíz, en sync) → merge a
   `main` → Tienda → Actualizar. Si cambió el contrato público: actualizar
   `theme/` y probar con su harness.
