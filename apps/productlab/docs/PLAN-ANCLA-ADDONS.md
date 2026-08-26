# Plan de migración: arquitectura «ancla + addons»

> **Estado**: EN EJECUCIÓN · iniciado 2026-08-14
> **Tienda piloto**: playerpro (hubpro.cl, oculta con contraseña, lanzamiento inminente)
> **Este documento es la fuente de verdad del avance.** Cada tarea tiene checkbox
> y criterio de verificación; se marca solo cuando el criterio se cumplió de
> verdad (contra el estado real de la tienda, no contra un código HTTP).

---

## 1. Por qué

Jumpseller limita **~100 variantes por producto** (banner del panel: «Límite de
variantes superado»). ProductLab generaba una variante por combinación de pasos
(Plasma Creator: 108 combinaciones → 102 creadas, 6 imposibles → error 404 en
cada publicación). Cualquier modelo con 4-5 pasos revienta el tope; el enfoque
por combinaciones **no escala**.

### Alternativas descartadas (decisión del usuario)

| Alternativa | Por qué se descartó |
|---|---|
| Un producto por color | «No escala» |
| Un producto por componente (carro con líneas por pieza) | La boleta mostraría precios por componente; el cliente solo debe ver el **precio total** |
| Crear variantes bajo demanda al comprar | La tienda dejaría de funcionar independiente de KIMOS |

### Arquitectura aceptada: **ancla + addons**

- **1 producto Jumpseller por modelo** (el «ancla»).
- **Color = única opción tipo `option`** → 2-3 variantes reales, cada una con
  `image_id` (foto correcta en el carro). Muy por debajo del tope.
- **Todos los demás pasos = opciones tipo `addon`** (checklist), un addon por
  valor, con `addon_price` a nivel de opción. Los addons **no generan variantes**.
- **Precio base del ancla = configuración más económica** (rebase); cada
  `addon_price` es el **delta ≥ 0** respecto de esa base.
- **Total = base + Σ addons, calculado por el servidor de Jumpseller** —
  verificado en vivo: producto TEST $1.000 + addon $500 → el carro cobró $1.500.
- El **kit del theme** sigue renderizando el paso a paso actual: marca los
  checkboxes nativos (ocultos) según la selección y pulsa el botón nativo →
  **un POST** `/cart/add/{product_id}`, **una línea** en el carro.
- **Dependencias, compatibilidades y stock por combinación siguen en el kit**
  (lógica KIMOS); Jumpseller solo cobra y despacha.
- **No se genera ninguna combinación en ninguna parte** (ni en la app, ni en
  la tienda, ni bajo demanda).

### Requisitos que la arquitectura cumple

1. Jumpseller como plataforma de carga; la tienda **funciona sin KIMOS**.
2. KIMOS orquesta: configura, edita experiencia, actualiza precios, gestiona.
3. La boleta muestra **solo el precio total** (una línea por producto).
4. Sin tope práctico de combinaciones (Plasma: 11 addons + color con 2 variantes).

---

## 2. Verificaciones ya realizadas (2026-08-14)

- [x] Opción addon con `addon_price` vía API: el `option_type` REAL es **`checklist`** (enum de la doc: option|input|text|file|color|checklist — "addon" no existe y devolvía 500 seco por cada opción; backend 0.60.3 lo traduce). `addon_price` "se usa con opciones checklist" según la misma doc.
- [x] El storefront agrega al carro con `POST /cart/add/{product_id}` con campos `option_id=value_id` (+ qty); líneas de la misma combinación fusionan qty.
- [x] El servidor suma base + addons: TEST $1.000 + «PRUEBA» $500 → carro $1.500.
- [x] El theme hubpro renderiza addons como checklist (`partials/product_options.liquid`, `data-addon-price`) y suma el precio mostrado (`theme.js` → `updateAddonTotal`).
- [x] El carro de página es editable (`templates/checkout/cart.liquid` + `components/cart-products.liquid`); el drawer lateral es de plataforma.

**Pendiente de verificar (bloqueante temprano):**

- [ ] **Tope de opciones por producto** en Jumpseller (Plasma necesita ~12 opciones: 1 color + ~11 addons). Se verifica con la PRIMERA publicación de Plasma bajo el modelo nuevo (Fase 4): si hay tope, el push de opciones lo reporta con error visible y el panel muestra cuántas quedaron. Plasma ya está roto con el modelo viejo (banner de límite), así que no se arriesga nada nuevo.
- [ ] Correo de confirmación de pedido: qué muestra por línea (¿lista addons?, ¿muestra «(+$precio)»?). Compra de prueba en Fase 4.

---

## 3. Fases y tareas

La numeración es de seguimiento; «Día 1 / Día 2» es orientativo — puede ser un
sprint largo o varios días. **Regla de oro**: probar con UN modelo antes de
migrar el resto; confirmar contra la tienda real.

### Fase 0 — Verificaciones previas

- [ ] **0.1** Verificar tope de opciones por producto: crear producto de prueba con 15 opciones addon vía API; confirmar en panel que existen todas.
  - *Criterio*: 15/15 opciones visibles en el panel del producto de prueba.
- [ ] **0.2** Confirmar `addon_price` con decimales/valores CLP grandes (ej. $125.990) y que el carro cobre exacto.
  - *Criterio*: carro muestra base+addon exactos en CLP.

### Fase 1 — App ProductLab: publicar como ancla + addons

- [x] **1.1** Cálculo de **rebase**: precio ancla = configuración más económica del modelo; delta por valor de paso = precio(valor) − precio(valor más barato del paso), garantizando deltas ≥ 0 y que Σ mínima = precio base. *(`buildStoreModel` + `minExtraDe`; test verde)*
  - *Criterio*: ancla + Σ deltas == precio por combinación: EXACTO en precio fijo (test del pack); en precio auto la diferencia es < el redondeo (< $1.000), porque el redondeo final ya no puede aplicarse por combinación — no existen combinaciones. Modo «precio de la tienda» con default no-mínimo se bloquea con error explicativo (evita deriva del ancla).
- [x] **1.2** Publicación: color como única opción `option` (variantes con `image_id` — el backend asegura la foto del color como imagen del producto y la asocia); demás pasos como opciones `addon` «Paso: Valor» con `addon_price` = delta y un valor «Sí» (el theme la pinta como checkbox, envía `option_id=Yes`). Adopción idempotente por nombre (opciones/valores) y por combinación (variantes). *(código + tests; verificación en panel pendiente → Fase 4)*
- [x] **1.3** Poda de la estructura antigua al migrar: `push_options` ya borra opciones/valores ausentes y `push_variants` poda por combinación → al re-aplicar, las variantes-combinación viejas caen solas. *(verificación con Plasma en vivo → Fase 4)*
- [x] **1.4** Stock: variantes de color con stock real (mínimo entre base y componentes del color); el resto lo gobierna el kit. *(test verde: escaso=2, surtido=30)*
- [x] **1.5** Bloqueo `MAX_COMBOS=100` retirado del publicar y del botón Aplicar; `enumerarCombos` queda como conteo informativo y para la lógica del kit. Aviso suave si un producto genera >40 opciones (tope de opciones aún sin verificar → Fase 0).

### Fase 2 — Kit del theme: compra en un POST

- [x] **2.1** Kit agrupa los checkboxes addon "Paso: Valor" en grupos VIRTUALES (misma interfaz que un grupo nativo): el paso a paso los pinta igual, elegir un valor marca su checkbox y desmarca los hermanos (mutaciones primero, `change` después — el theme recalcula su precio), y el submit nativo sigue siendo el que compra. Paso oculto por dependencia = ningún checkbox marcado; al reaparecer recupera su default. *(kit 5.30.0; test `theme/test/run-addons.mjs` verde)*
  - *Criterio pendiente en vivo*: compra de prueba en hubpro.cl/test → carro con UNA línea, precio total correcto, foto del color elegido (→ Fase 4).
- [x] **2.2** UI nativa oculta: el bloque original del theme (checklist + color incluidos) ya queda bajo `kc-hidden-native`, vivo para el submit. Sin cambios necesarios.
- [x] **2.3** Precio mostrado por el kit = variante de color + Σ `data-addon-price` marcados — la misma cuenta del theme y del servidor. La variante se casa SOLO con los grupos reales (los addons no son variante): se acabó el «No disponible» por combinación.
- [x] **2.4** Resiliencia: sin catálogo KIMOS el kit no monta y la ficha nativa (checklist + color) queda operativa — comportamiento ya existente, sin cambios.

### Fase 3 — Theme hubpro: presentación

- [x] **3.1** Sufijo «(+$precio)» suprimido en las líneas de carro/checkout/pedidos: vivía en UN solo sitio (`partials/store_product.liquid`, que renderiza las líneas en carro, checkout, success y pedidos del cliente). El nombre del addon («Paso: Valor») se mantiene — es lo que el taller lee en el pedido. La FICHA nativa (`partials/product_options.liquid`) conserva su «(+precio)»: solo se ve en modo resiliencia (sin KIMOS) y ahí orienta.
- [ ] **3.2** Revisar el drawer lateral (plataforma, no editable): si muestra «(+$precio)» y no se puede quitar, documentarlo y decidir con el usuario si se desactiva el drawer.
  - *Criterio*: decisión registrada aquí (observar en la compra de prueba de Fase 4).
- [ ] **3.3** Correo de confirmación de pedido: compra de prueba real y revisar el mail (líneas, precios por addon).
  - *Criterio*: captura del mail revisada con el usuario; si muestra precios por addon, evaluar plantilla de mail editable.
- [x] **3.4** Zip del theme entregado (`hubpro1_theme_ancla_addons_20260814.zip`): partial del carro editado + kit 5.30.0 en assets + `KIMOS_ASSET_V` nuevo en custom.js. Cambios exactos vs el zip original: `partials/store_product.liquid`, `assets/kimos-configurador.js`, `assets/custom.js`.

### Fase 4 — Migrar Plasma Creator (piloto) y QA

- [ ] **4.1** Migrar Plasma Creator: poda de 102 variantes → publicar ancla + addons.
  - *Criterio*: publicación «Sincronizado» sin errores; panel sin banner de límite.
- [ ] **4.2** QA punta a punta en hubpro.cl: configurar → añadir → carro → checkout de prueba → correo.
  - *Criterio*: precio total correcto en cada paso; foto de color correcta en carro; una sola línea.
- [ ] **4.3** Migrar los demás modelos de playerpro (después de que 4.2 pase).
  - *Criterio*: todos los modelos publican sin errores; muestreo de precios contra la app.

### Fase 5 — Despliegue y cierre

- [x] **5.1** Release construido y pusheado: **KIMOS 0.75.0 (backend 0.60.0) · ProductLab 3.42.0 (kapp empaquetado) · kit 5.30.0** — tests verdes (`test-app.mjs`, `run-contrato-v2.mjs`, `run-addons.mjs`, `run-assets.mjs`; los Playwright 3D fallan por entorno sin .glb generado, igual que antes del cambio).
- [ ] **5.2** Usuario despliega (setup-kimos + Tienda de aplicaciones + zip del theme entregado) y confirma `healthz` → `backendVersion: 0.60.0`.
- [ ] **5.3** Actualizar `docs/JUMPSELLER.md` y `ARQUITECTURA.md` con la arquitectura nueva; marcar este plan como COMPLETADO.

---

## 4. Decisiones tomadas (no reabrir sin el usuario)

1. **Ancla + addons** es la arquitectura definitiva (aceptada 2026-08-14 tras verificación en vivo).
2. Precio base = configuración **más económica**; deltas siempre ≥ 0.
3. Color es la única opción-variante (por la foto en el carro). Si un modelo no tiene color, una sola variante por defecto.
4. El cliente **nunca** ve precios por componente en boleta/carro (de ahí Fase 3.1).
5. Dependencias/compatibilidades/stock-por-combinación viven en el kit, no en Jumpseller.
6. Versión congelada al iniciar: KIMOS 0.74.5 (backend 0.59.5) · ProductLab 3.41.0 · kit 5.29.0. Release del plan: KIMOS 0.75.0 (backend 0.60.0) · ProductLab 3.42.0 · kit 5.30.0 — no se publica encima hasta que el usuario confirme su deploy.
7. Redondeo con ancla + addons (3.42.2): el ancla se redondea con la política de siempre (…990) y cada recargo va al MÚLTIPLO del paso de redondeo ($1.000) — así ancla + Σ addons termina en 990 en cualquier configuración. En precio fijo los montos son exactos, sin redondeo.
8. «Publicar SE VE» (backend 0.61.0 + kit 5.31.0): faro `GET /definition/version` (~40 bytes, max-age=5) + catálogo con la versión en la URL (immutable 1 año). Ninguna caché del camino puede servir catálogo viejo; editar y ver cambios no requiere limpiar nada. Cobertura: `theme/test/run-faro.mjs`.

### Mejoras operativas fuera de fase (2026-08-19 · ProductLab 3.45.0 + backend 0.61.7)

- **Bitácora de publicación**: los avisos del espejo de imágenes y de la página del catálogo quedan GUARDADOS en la pestaña Publicación (copiables), no solo en la notificación efímera. Pedido del usuario tras el aviso «HTTP 502 · Token expired».
- **Presupuesto de tiempo del espejo** (`mirror_assets_to_product`, 18 s): la pasada devuelve siempre antes del corte del gateway; lo no subido queda declarado pendiente y la publicación siguiente lo retoma sola. Mata el «HTTP 502» que se tragaba el mapa completo.
- **Costo con IVA incluido** (por componente, `costConIva`): el «Costo proveedor» se asume NETO; si se carga con IVA (boleta/precio web) se marca en el formulario y el cálculo lo descuenta antes del margen. Cubierto en formulario, CSV (columna `costoConIva`), agente (UPSERT_COMPONENT) y snapshot. Tests en `test-app.mjs`.

### Incidente 2026-08-19 (caída de KIMOS en horario de trabajo) y respuesta — kit 5.35.0 / ProductLab 3.46.0

**Lo que pasó**: KIMOS se cayó mientras el usuario publicaba; durante la caída la ficha de Plasma en hubpro.cl quedó en la vista nativa (lista de checkboxes). La consola del usuario probó la causa: el theme ACTIVO corría **kit 5.31.0** (`kv=1786687412000`), anterior a la copia en la tienda con `same-origin` (5.34.0) — ese kit solo sabía pedirle a KIMOS. El theme que se activó desde el zip traía assets viejos.

**Contrato de DISPONIBILIDAD del kit (5.35.0), verificado en `run-faro.mjs`**:
1. Faro con tope de 2,5 s (KIMOS lento = KIMOS caído; nunca se espera colgado).
2. Fuente primaria: **página de la tienda** (mismo Jumpseller que sirve la ficha — si el comprador ve la ficha, la página está). KIMOS solo confirma frescura.
3. KIMOS caído del todo → la ficha monta 100 % desde la tienda, cero respuestas de KIMOS (test dedicado).
4. Todo caído (página incluida) → último refugio: copia del navegador sin confirmar versión. 403/404 real (instancia borrada) NO revive copias.
5. Catálogo de KIMOS con tope de 8 s; sin fuente alguna → ficha nativa del theme, sin velo eterno.

**Regla operativa**: los assets del theme activo se actualizan SIEMPRE desde el KIT MANUAL de ProductLab tras actualizar la app — un theme activado desde zip puede traer kit viejo y revivir la dependencia de KIMOS.

### Regla de oro de datos (decisión del usuario, 2026-08-19) — kit 5.36.0 / ProductLab 3.47.0 / backend 0.61.8

**«No vender con datos de ayer»**: la ficha KIMOS solo se muestra con datos CONFIRMADOS — la página publicada en la tienda (la publicación ES esa página) o una copia cuya versión confirmó el faro. Se eliminó todo servicio de copias sin confirmar (el "último refugio" de 5.35.0 y el defCache heredado): si no hay fuente confiable, manda la ficha nativa del theme, que cobra siempre los precios REALES de Jumpseller. Verificado en `run-faro.mjs` (todo caído + copia guardada ⇒ el kit NO monta).

**«Actualizar actualiza todo»** (detección de deriva de versiones, doble vía):
1. La publicación declara `kitExpected` (el kit que acompaña a la app); el kit del theme lo compara con su versión y GRITA en consola si quedó viejo (`window.KIMOS_KIT_DESACTUALIZADO`).
2. Al publicar, el backend sonda `/assets/kimos-configurador(.min).js` de la tienda y devuelve `kitTienda`; la app compara y deja el aviso «⚠ EL THEME CORRE UN KIT VIEJO…» en la notificación y la bitácora. (Tras muro de contraseña la sonda puede no ver el asset: entonces no afirma nada — la vía 1 sigue cubriendo.)
Nota técnica: Jumpseller no expone API para escribir assets del theme; por eso el paso KIT MANUAL no puede automatizarse del todo, pero ya no puede pasar inadvertido.

### ENFOQUE POR PRODUCTO (exigido por el usuario, 2026-08-20) — kit 5.37.0 / ProductLab 3.48.0 / backend 0.62.0

**Diagnóstico que lo motivó** (con la evidencia del usuario: los adjuntos SÍ están en el panel de Jumpseller): la publicación monolítica hacía UNA pasada larga de espejo por los 5 productos; el gateway cortaba la respuesta (502) DESPUÉS de que los archivos subieran pero ANTES de que el mapa volviera a la app → el catálogo nunca se reescribía (fotos de Ingram/KIMOS eternas), cada publicación re-subía lo mismo (duplicados `_N`) y tardaba minutos.

**La unidad ahora es EL PRODUCTO**:
1. **Página por producto**: `kimos-productlab-<instancia>-p<id de producto>`, con TODO el contenido de ese producto. El kit deriva el permalink solo (conoce el id de la ficha donde corre) y la pide ANTES que la página agregada; la agregada queda de respaldo/compat.
2. **Versión por producto**: publicar sella `pubAt` en la entrada del producto; el faro con `?product=` devuelve ESA versión → publicar un producto no invalida páginas ni copias de los demás.
3. **Publicar por producto**: botón «Publicar este producto» en la pestaña Publicación (aloja SUS fotos + escribe SU página, en segundos). El botón global ahora es un bucle de esa misma unidad, con bitácora POR PRODUCTO (fotos alojadas/pendientes, página, hora) y el `motor` del espejo visible (se VERIFICA qué versión del backend corrió, no se supone).
4. **Espejo sin churn**: un adjunto que la tienda ya LISTA pero aún sin URL pública NO se re-sube (era la fábrica de duplicados `_1.._11` y de los 7 minutos); se recoge cuando la tienda publique su URL.

Cobertura offline: `run-faro.mjs` (página -p<id> primero, caída a la agregada, `?product=` en el faro, pubAt válido en agregada vieja) + suite completa verde.

### SIMPLIFICACIÓN v6 (decisión del usuario, 2026-08-20) — kit 6.0.0 / ProductLab 3.49.0 (backend queda en 0.62.0)

**Lectura del kit, sin sistema de versiones**: la ficha lee la página publicada (`-p<id>` primero, agregada después) con `cache: no-store` — publicar se ve en la visita siguiente por construcción. CERO llamadas a KIMOS en la visita (se eliminaron el faro, las copias versionadas del navegador y el `?v=`); KIMOS queda solo como respaldo de ARRANQUE para tiendas que aún no publican su página, con tope de 8 s. Fundamento: los precios cobrados Y mostrados salen de Jumpseller (addons nativos + DOM del theme), así que el catálogo no puede cobrar mal — solo verse como su última publicación.

**Vencimiento local (licencia, opción b del usuario)**: cada publicación sella fecha y plazo (`kitTtlDias`, configurable en Publicación; default 90; 0 = no vence). Pasado el plazo sin publicar, el kit no monta y queda la ficha nativa (que cobra bien). 100% local: una caída de KIMOS no lo gatilla; publicar lo renueva.

**UX de publicar — DOS ideas en vez del trío confuso**:
- **Guardar** = ProductLab + refresco visual automático de la ficha (el auto-republish ahora solo reescribe lo que CAMBIÓ: comparación sin sello contra lo publicado).
- **Actualizar en la tienda** (por producto, y "Actualizar TODO" con confirmación) = precios/opciones/variantes (app Productos) y fotos nuevas EN PARALELO, y al final su página. El botón del editor ("Aplicar") ahora es esto. El botón global del header pasó a llamarse "Refrescar fichas" (solo visual).
- **Mapa persistente de fotos** (`assetMap` en la definición): lo ya alojado se reescribe sin red — publicar sin fotos nuevas no toca el espejo; con pendientes, sí vuelve a recogerlas.

Cobertura: `run-faro.mjs` reescrito al contrato v6 (17 checks: cero-KIMOS, arranque, vencimiento con default/0/fresco, kit viejo) + suite completa verde.

### TRES VELOCIDADES (UX definida por el usuario, 2026-08-20) — ProductLab 3.50.0 (kit sigue 6.0.0, backend 0.62.0)

El botón único "Actualizar en la tienda" amarraba la carga pesada (fotos/página) a la lenta (precios vía app Productos: ~12 opciones + variantes contra la API de Jumpseller) — publicar se sentía eterno y sin señales. Modelo nuevo, igual por producto y global:

1. **GUARDAR** — solo KIMOS, instantáneo. El auto-republish tras guardar ya NO toca Jumpseller (solo refresca la copia barata en Firestore para el agente/arranque).
2. **ACTUALIZAR PRECIOS** (`$ Precios` en el editor / fila / "Actualizar precios de TODO") — ancla + recargos + variantes vía app Productos. Informa su duración.
3. **REARMAR** ("Rearmar" / "Rearmar producto" / "Rearmar TODO" / "Rearmar tienda" en el header) — paso a paso + fotos QUE FALTEN (assetMap: lo alojado nunca se re-sube) + página `-p<id>`. Repetirlo sin cambios = solo la página, segundos. "Rearmar TODO" salta lo que no cambió.

Ambas acciones guardan primero y notifican "Guardado ✓" al tiro — lo lento es la tienda, no KIMOS. Confirmación antes de las acciones globales.

### CAUSA RAÍZ DE «LAS FOTOS SIGUEN SIENDO DEL PROVEEDOR» — backend 0.62.3 (2026-08-20)

El DIAG que pidió el usuario mostró el registro REAL de un adjunto de Jumpseller:

```json
{"id": 80248173, "customer_url": "https://images.jumpseller.com/store/hubpro1/34881864/attachments/8c6f…/mru2jmlj-wp44-5.png?1787200515"}
```

**La URL viene en `customer_url`, no en `url`.** El espejo leía `att.get("url")` → vacío → declaraba «aceptado pero aún sin URL» para TODOS los adjuntos, que en realidad subían perfectamente (el usuario los vio listados en el panel). Cadena de consecuencias, toda explicada por este único campo:

- «N pendientes, se recogerán en la próxima publicación», publicación tras publicación, para siempre.
- Duplicados `_1.._11`: se re-subía lo que no se sabía reconocer.
- **El catálogo nunca se reescribía**: sin URL de destino no hay sustitución, así que la ficha siguió pidiendo las fotos a KIMOS y al proveedor — el síntoma que arrastramos toda la semana.

Fix: `_url_adjunto(att)` lee la URL sea cual sea el campo (`customer_url`, `url`, `public_url`, `file_url`, `attachment_url`), prefiriendo la del CDN de la tienda; se usa al listar y al leer cada subida. Probado contra el registro real del DIAG.

**Lección**: el DIAG con el registro CRUDO fue lo que resolvió una semana de hipótesis. Ante «la API no devuelve lo que espero», volcar la respuesta literal antes de teorizar.

**Nota histórica**: los 502/503 y la lentitud eran un problema REAL y distinto (event loop bloqueado, 0.62.1; presupuesto incompleto, 0.62.2), pero no eran la causa de las fotos — se resolvieron por el camino.

### ESPEJO v4 — RASTREO POR ID + SANACIÓN DEL MAPA (2026-08-20) — ProductLab 3.51.0 / backend 0.63.0

Se FUSIONA con el hallazgo `customer_url` de arriba (dos sesiones llegaron a la misma escena por caminos distintos): el 0.62.3 arregló la lectura del campo; el v4 cierra lo que ese fix deja abierto. Porque incluso leyendo `customer_url`, la fila del listado **sigue sin traer `filename`** y su URL **sigue vacía mientras la tienda procesa el archivo**: un adjunto recién subido es **ANÓNIMO** — la publicación siguiente no puede reconocerlo, lo re-sube, y la re-subida re-encola el procesamiento (la fábrica de duplicados `_N` y del atasco «aceptado sin URL» del caso `mrt2lqat` seguía armada, solo que con ventana más corta).

**El arreglo (espejo v4)**: el POST de subida SÍ devuelve el `id` del adjunto — ese es el hilo.
1. **`pending` persistente** (`assetPend` en la definición, junto a `assetMap`): `{url_original: {id, intentos}}` viaja al backend en cada pasada y vuelve actualizado.
2. **Recogida por id**: cada pendiente se consulta con `GET /attachments/{id}`; con URL → al mapa; sin URL → sigue rastreado, **sin re-subir** (cero re-encolado).
3. **Desatasco automático**: 3 pasadas sin URL = atascado de verdad → se BORRA y se re-sube (el remedio manual documentado, automatizado).
4. **Limpieza de huérfanos**: las filas sin URL sin rastreo que dejó el v3 (irreconocibles para siempre) se borran antes de re-subir con rastreo.
5. **Fallos de listado visibles**: un listado que responde no-200 ya no se confunde con «no hay adjuntos» (aviso explícito). El extractor de URL es UNO solo: campos conocidos primero (`customer_url` a la cabeza) + red anidada/por dominio del CDN — nunca una URL ajena (una fila que eco-ara la URL de origen «mapearía» cada foto a sí misma).
6. **Sanación del mapa muerto** (consecuencia directa del «borrón y cuenta nueva» del piloto): el mapa persistente se aplica sin red y el espejo excluye las URLs de Jumpseller, así que un adjunto BORRADO de la tienda dejaba su foto rota en la ficha PARA SIEMPRE — Rearmar no la recuperaba, al contrario de lo que se supuso. Ahora cada URL ya alojada del producto se verifica con una lectura barata al CDN: solo el 404/410 inequívoco la declara muerta (`dead`), la app la olvida del mapa y el original se re-aloja en la misma pasada. Un fallo transitorio no mata nada.

La bitácora distingue «en proceso en la tienda: N (rastreadas por id)» de «pendientes» a secas, y el motor se declara `espejo v4`. Cobertura: `backend/test_jumpseller_espejo.py` simula la tienda con la forma REAL de la API (`customer_url`, verificada contra el registro del DIAG) y reproduce el estado exacto del piloto — atascados anónimos, viejo con URL, mapeo muerto tras el borrón — verificando convergencia en dos pasadas con CERO re-subidas y re-alojado de lo borrado.

### TRES FRENTES DEL PILOTO (2026-08-22) — ProductLab 3.55.0 / kit 6.1.0 / backend 0.64.0

**1. «Name has already been taken» al aplicar el paso "Garantía y Soporte"** (fallaba en todos los productos menos el primero): `fetch_product_options` leía UNA página sin paginar; con ancla+addons (una opción por valor de paso) los PCs superan las ~20 opciones y las del final —el último paso agregado— eran INVISIBLES para la adopción por nombre → cada apply intentaba re-crearlas contra la unicidad de la tienda. El mismo bug de raíz que el listado de adjuntos. Fix: paginado real (y `_fetch_all_pages` ya no corta por `len < limit` — hay endpoints que topan la página por su cuenta: termina en página vacía o sin filas nuevas), más adopción ante el conflicto (si el POST choca, se relee y se enlaza por nombre). Cobertura: `backend/test_jumpseller_opciones.py` con tienda simulada de paginación tozuda.

**2. Fotos "pendientes" eternas e inexplicables** (4 en Banshee Mini que jamás subían): el recolector de la app metía al espejo CUALQUIER archivo servido por `/api/public/` (un .glb, por ejemplo) y el backend lo descartaba EN SILENCIO por extensión → la app lo contaba como pendiente para siempre sin decir cuál era. Fix: el recolector solo toma strings con pinta de imagen (mismo filtro que las externas), el backend NOMBRA lo que descarta (`skipped` + aviso), `_EXT_IMAGEN` suma .jfif/.bmp, y el mensaje de Rearmar lista los archivos sin alojar («sin alojar: a.png, b.glb…»).

**3. Transparencia y editabilidad del paso a paso** (contrato 6.1):
- El NOMBRE de la card es del dueño y va TAL CUAL — el kit ya no le antepone la cantidad («16GB DDR5» con qty 2 salía «2× 16GB DDR5», que se lee 32GB). La cantidad vive en el DETALLE bajo el nombre: automático «2× ‹specs/nombre del componente elegido›», o manual con el campo `detalle` del valor (⚙ del valor → "detalle en la tienda").
- `nota` por paso (editor del paso → "comentario del paso"): texto del dueño bajo el título del paso en la tienda y en el previsualizador.
- La foto de una card sale SOLO de componentes del TIPO del paso (o la manual del valor): un valor «Integrada» (GPU sin foto + fuente de poder asociada) mostraba la foto de la fuente — ya no; sin foto propia ni de su tipo, la card va sin imagen.
- SET_PRODUCTO_STEPS acepta y conserva `nota` y `detalle`.
- Kit 6.1.0 (subir a los Assets del theme, como siempre); `kitExpected: '6.1.0'` hace que las tiendas con kit viejo lo griten. Test de contrato actualizado (`run-contrato-v2.mjs`).

**Ideas del usuario aceptadas para después del QA (no bloquean Fase 4)**:
- Publicación POR PRODUCTO en tiempo real desde la app (además del botón global).
- Portabilidad: el modelo página-con-datos + kit en assets + fotos espejadas no depende de nada exclusivo de Jumpseller; documentarlo como contrato para otros ecommerce.

## 5. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Tope de opciones por producto desconocido | Fase 0.1 antes de construir |
| Drawer del carro no editable muestra «(+$precio)» | Fase 3.2, decisión con usuario |
| Correo de confirmación fuera de nuestro control | Fase 3.3, compra de prueba |
| Migración rompe el producto vivo (tienda por lanzar) | Piloto en Plasma; poda reversible (los datos maestros viven en KIMOS) |
| Sandbox sin salida a hubpro.cl | Verificaciones vía snippets en el navegador del usuario; zip del theme como fuente de verdad |

---

## CONTRATO DE PROPIEDAD DEL DATO (2026-08-20) — backend 0.63.0 / ProductLab 3.54.0

Nació de una pérdida real: el usuario editó la descripción de un producto en
Jumpseller, aplicó unos pasos desde ProductLab —que solo quería cambiar el
precio— y el texto se perdió. La causa fue estructural, no un descuido: el
push mandaba el item COMPLETO, así que cualquier escritura arrastraba TODOS
los campos con la copia envejecida de KIMOS.

**Cada dato tiene UN dueño, y el que no es dueño no escribe sin permiso.**

| Dato | Dueño | Cómo se comporta |
|---|---|---|
| Precio, opciones, variantes, nombre | **ProductLab** | Los calcula y los escribe al aplicar. |
| Descripción de la ficha | **La tienda** | Solo lectura en ProductLab (renderizada). Se edita en la app Productos / panel. Escribirla desde KIMOS exige pedirlo (SET_DESCRIPCION_TIENDA). |
| Stock | **La tienda** | Baja con cada venta: ESE dato manda. ProductLab calcula el suyo desde los componentes en bodega y muestra AMBAS cifras; escribir el de KIMOS es un botón aparte con confirmación que advierte que se pierde lo vendido. |
| Galería de fotos | **La tienda** | Ya era así (se gestiona en la app). |

Mecánica que lo sostiene:

1. **Intención explícita** (`campos` en `push_product_to_jumpseller`): solo viaja lo que el llamador vino a cambiar. Sin lista, `CAMPOS_DE_LA_TIENDA` (description/stock/stockUnlimited) se omiten siempre.
2. **Pull** (`POST /{instancia}/items/{item}/pull-from-store`): trae el estado real de la tienda a KIMOS. Lo ejecuta el botón «Traer de la tienda» y también, automáticamente, antes de aplicar.
3. **Auditoría** (`audit_log`): cada push y cada pull deja el valor ANTERIOR y el nuevo, con quién y de dónde. Un dato pisado se puede recuperar.

**Decisión explícita del usuario (no reabrir)**: ProductLab **no** gestiona
pedidos ni automatiza descuentos de stock — eso será otra app. Lo que se hizo
aquí es que el diseño sea escalable a eso y, mientras tanto, **no haga perder
datos**. Cuando exista la app de pedidos, el camino natural es que ella
descuente el stock de los componentes (los que están en bodega; los que se
compran al proveedor quedan sin control, como hoy) y que ProductLab siga sin
escribir stock por su cuenta.

**Pendiente útil**: vista de la auditoría dentro de KIMOS (hoy el registro se
escribe pero solo se lee en Firestore).
