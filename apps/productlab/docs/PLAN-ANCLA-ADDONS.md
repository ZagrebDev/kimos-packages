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

- [x] Opción tipo `addon` con `addon_price` se crea vía API (`push_options` ya lo soporta).
- [x] El storefront agrega al carro con `POST /cart/add/{product_id}` con campos `option_id=value_id` (+ qty); líneas de la misma combinación fusionan qty.
- [x] El servidor suma base + addons: TEST $1.000 + «PRUEBA» $500 → carro $1.500.
- [x] El theme hubpro renderiza addons como checklist (`partials/product_options.liquid`, `data-addon-price`) y suma el precio mostrado (`theme.js` → `updateAddonTotal`).
- [x] El carro de página es editable (`templates/checkout/cart.liquid` + `components/cart-products.liquid`); el drawer lateral es de plataforma.

**Pendiente de verificar (bloqueante temprano, Fase 1):**

- [ ] **Tope de opciones por producto** en Jumpseller (Plasma necesita ~12 opciones: 1 color + ~11 addons). Probar creando un producto con 15+ opciones antes de construir nada encima.
- [ ] Correo de confirmación de pedido: qué muestra por línea (¿lista addons?, ¿muestra «(+$precio)»?).

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

- [ ] **1.1** Cálculo de **rebase**: precio ancla = configuración más económica del modelo; delta por valor de paso = precio(valor) − precio(valor más barato del paso), garantizando deltas ≥ 0 y que Σ mínima = precio base.
  - *Criterio*: para Plasma, precio(ancla) + Σ deltas de la config X == precio actual de la config X, para TODAS las combinaciones (test unitario que recorre el equipo completo).
- [ ] **1.2** Publicación: color como única opción `option` (variantes con `image_id`); demás pasos como opciones `addon` (un valor = un addon con `addon_price` = delta). Adopción idempotente (re-publicar no duplica opciones ni variantes).
  - *Criterio*: publicar dos veces seguidas → segunda pasada reporta «sin cambios»; panel muestra N variantes de color y M addons correctos.
- [ ] **1.3** Poda de la estructura antigua al migrar: eliminar variantes-combinación sobrantes y opciones obsoletas del producto existente (Plasma tiene 102 variantes que deben bajar a las de color).
  - *Criterio*: Plasma queda con solo las variantes de color; sin banner de límite; sin 404 al publicar.
- [ ] **1.4** Stock: variantes de color con stock real (mínimo de componentes del color); stock de los demás componentes lo sigue gobernando el kit (`comboStock`), que deshabilita valores agotados.
  - *Criterio*: valor agotado aparece deshabilitado en el configurador; la variante de color refleja el stock del componente más escaso.
- [ ] **1.5** Bloqueo antiguo `MAX_COMBOS=100`: ya no aplica al publicar (no se generan combos); mantener el cálculo solo para lógica interna del kit si hace falta.
  - *Criterio*: un modelo con >100 combinaciones publica sin advertencia de tope.

### Fase 2 — Kit del theme: compra en un POST

- [ ] **2.1** Kit mapea la selección del paso a paso → value_ids de addons + variante de color; marca los checkboxes nativos ocultos y usa el submit nativo (un POST, una línea).
  - *Criterio*: compra de prueba en hubpro.cl/test → carro con UNA línea, precio total correcto, foto del color elegido.
- [ ] **2.2** Ocultar la UI nativa de opciones (checklist y selector de color) sin romper el submit; el paso a paso KIMOS es la única UI visible.
  - *Criterio*: en la ficha solo se ve el configurador KIMOS; el POST sigue llevando los campos nativos.
- [ ] **2.3** Precio mostrado por el kit == precio que cobrará el servidor (base + deltas), sin depender de `updateAddonTotal` del theme.
  - *Criterio*: precio del configurador == precio del carro en 3 configuraciones distintas (mínima, máxima, intermedia).
- [ ] **2.4** Resiliencia: si el catálogo KIMOS no responde, la ficha nativa (checklist + color) sigue permitiendo comprar.
  - *Criterio*: con el catálogo bloqueado (devtools), se puede añadir al carro igual.

### Fase 3 — Theme hubpro: presentación

- [ ] **3.1** Suprimir el sufijo «(+$precio)» de los addons en carro y checkout (`components/cart-products.liquid`, plantillas de checkout) — el cliente solo ve el total.
  - *Criterio*: carro y checkout muestran nombre del valor sin «(+$…)»; total intacto.
- [ ] **3.2** Revisar el drawer lateral (plataforma, no editable): si muestra «(+$precio)» y no se puede quitar, documentarlo y decidir con el usuario si se desactiva el drawer.
  - *Criterio*: decisión registrada aquí.
- [ ] **3.3** Correo de confirmación de pedido: compra de prueba real y revisar el mail (líneas, precios por addon).
  - *Criterio*: captura del mail revisada con el usuario; si muestra precios por addon, evaluar plantilla de mail editable.
- [ ] **3.4** Zip del theme editado listo para subir (el usuario lo sube al panel).
  - *Criterio*: zip entregado con lista exacta de archivos cambiados.

### Fase 4 — Migrar Plasma Creator (piloto) y QA

- [ ] **4.1** Migrar Plasma Creator: poda de 102 variantes → publicar ancla + addons.
  - *Criterio*: publicación «Sincronizado» sin errores; panel sin banner de límite.
- [ ] **4.2** QA punta a punta en hubpro.cl: configurar → añadir → carro → checkout de prueba → correo.
  - *Criterio*: precio total correcto en cada paso; foto de color correcta en carro; una sola línea.
- [ ] **4.3** Migrar los demás modelos de playerpro (después de que 4.2 pase).
  - *Criterio*: todos los modelos publican sin errores; muestreo de precios contra la app.

### Fase 5 — Despliegue y cierre

- [ ] **5.1** Release: backend (si hubo cambios), app ProductLab, kit del theme — bumps de versión según convención (patch fixes / minor features), tests (`node test/test-app.mjs`, `theme/test/run-contrato-v2.mjs`), push a main + rama de trabajo en los repos tocados.
- [ ] **5.2** Usuario despliega (setup-kimos + Tienda de aplicaciones + kit al theme) y confirma `healthz` → `backendVersion`.
- [ ] **5.3** Actualizar `docs/JUMPSELLER.md` y `ARQUITECTURA.md` con la arquitectura nueva; marcar este plan como COMPLETADO.

---

## 4. Decisiones tomadas (no reabrir sin el usuario)

1. **Ancla + addons** es la arquitectura definitiva (aceptada 2026-08-14 tras verificación en vivo).
2. Precio base = configuración **más económica**; deltas siempre ≥ 0.
3. Color es la única opción-variante (por la foto en el carro). Si un modelo no tiene color, una sola variante por defecto.
4. El cliente **nunca** ve precios por componente en boleta/carro (de ahí Fase 3.1).
5. Dependencias/compatibilidades/stock-por-combinación viven en el kit, no en Jumpseller.
6. Versión congelada al iniciar: KIMOS 0.74.5 (backend 0.59.5) · ProductLab 3.41.0 · kit 5.29.0. No se publica encima sin confirmación de deploy del usuario.

## 5. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Tope de opciones por producto desconocido | Fase 0.1 antes de construir |
| Drawer del carro no editable muestra «(+$precio)» | Fase 3.2, decisión con usuario |
| Correo de confirmación fuera de nuestro control | Fase 3.3, compra de prueba |
| Migración rompe el producto vivo (tienda por lanzar) | Piloto en Plasma; poda reversible (los datos maestros viven en KIMOS) |
| Sandbox sin salida a hubpro.cl | Verificaciones vía snippets en el navegador del usuario; zip del theme como fuente de verdad |
