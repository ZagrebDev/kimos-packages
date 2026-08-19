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

## 5. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Tope de opciones por producto desconocido | Fase 0.1 antes de construir |
| Drawer del carro no editable muestra «(+$precio)» | Fase 3.2, decisión con usuario |
| Correo de confirmación fuera de nuestro control | Fase 3.3, compra de prueba |
| Migración rompe el producto vivo (tienda por lanzar) | Piloto en Plasma; poda reversible (los datos maestros viven en KIMOS) |
| Sandbox sin salida a hubpro.cl | Verificaciones vía snippets en el navegador del usuario; zip del theme como fuente de verdad |
