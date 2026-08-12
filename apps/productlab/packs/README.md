# Packs 3D — de un modelo a un producto configurable en la tienda

Cada carpeta es un producto listo para cargar en ProductLab: el payload del
**modelo** (`model3d.json`), el de sus **pasos** (`pasos.json`) y un README con
la secuencia exacta. Los `.glb` y las texturas viven en el repo
**`personalizador`** (`public/models/`, `public/textures/`) — se suben una vez
desde la app y sus URLs reemplazan los `REEMPLAZAR_…` del JSON.

| Pack | Lado mayor | Partes tintables |
|---|---|---|
| `balancin` | 122 cm | Laterales, Peldaños |
| `banca-estrellas` | 40 cm | Laterales, Asiento |
| `baul-sofa` | 94 cm | Laterales, Cuerpo |
| `camarote` | 230 cm | Madera |
| `contenedor` | 63 cm | Laterales, Cuerpo |
| `juguetera` | 139 cm | Madera |
| `mecedora-cuna` | 149 cm | Madera |
| `mini-silla` | 48 cm | Asiento, Estructura |
| `panel-ranurado` | 100 cm | Paneles, Accesorios |
| `pieza-union` | 19 cm | Madera |
| `resbalin` | 190 cm | Deslizador, Laterales, Peldaños |
| `ropero` | 120 cm | Repisas, Ganchos, Estructura |
| `torre-aprendizaje` | 88 cm | Peldaños, Estructura |
| `triangulo-pickler` | 86 cm | Laterales, Tablas, Estructura |
| `mesa-hanoi` | (mueble de pino, otro pipeline) | Superficie, Estructura |

Los 14 muebles infantiles comparten **una sola textura** (`plywood_col.webp`) y
los **mismos 6 acabados** (natural, blanco, rosa, celeste, verde, amarillo):
súbela una vez y reutiliza su URL en todos.

`build-packs-infantil.mjs` los regenera (`node packs/build-packs-infantil.mjs
[ruta-al-repo-personalizador]`); mide cada GLB con sus transformaciones de nodo
para llenar `realSizeCm` — el dato que habilita "Ver en tu espacio" (AR).

---

## Demo en 20 minutos (un producto)

1. **Plataforma lista**: despliega con setup-kimos e instala desde la Tienda de
   aplicaciones **Productos** y **ProductLab**.
2. **Conecta la tienda**: KIMOS → Configuración → Integraciones → Jumpseller →
   login + authtoken → *Probar conexión* → *Sincronizar*.
3. **Crea el producto** en ProductLab con el nombre del pack.
4. **Visor 3D** → activar → subir el `.glb`; en **Acabados**, subir
   `plywood_col.webp`. Copiar ambas URLs al `model3d.json` y aplicarlo
   (agente: *"aplica este SET_MODEL3D"* + JSON).
5. **Pasos**: aplicar `pasos.json` igual. El Estudio ya repinta el modelo al
   cambiar de acabado.
6. **Publicar** → *Publicación*: descarga los 3 archivos del kit y súbelos a
   **Assets** del theme de Jumpseller (el `custom.js` configurado trae ya la URL
   de tu catálogo). La ficha de la tienda queda con hero, configurador, 3D y AR.

Para sumar productos al demo: repetir 3→5 con otro pack (la textura ya está
subida, así que son dos pasos menos).

## Los tres modos de precio (para mostrar en el demo)

Los `pasos.json` genéricos son **solo acabados**: se ven y se configuran, pero
no mueven el precio. Eso es de los EJEMPLOS, no del sistema — ProductLab calcula
precio, margen, stock y entrega desde los componentes. Tres packs traen cada
modo listo para probar:

| Modo | Pack | Archivos extra | Qué muestra |
|---|---|---|---|
| **A · Precio real desde componentes** | `torre-aprendizaje` | `componentes.json` + `pasos-con-precio.json` | El Paso 00 (plancha + herrajes + corte y armado) forma el costo base; cada acabado enlaza su insumo real (barniz vs pintura) → elegir color **sube el precio** y la diferencia se ve en la card. Stock y entrega salen de los componentes. |
| **B · Recargo simple** | `balancin` | `pasos-con-recargo.json` | Sin modelar costos: precio fijo del producto y `priceDelta` por acabado premium (+$8.000 laterales, +$5.000 peldaños). La vía rápida para vender. |
| **C · Pasos que cambian el producto** | `panel-ranurado` | `componentes.json` + `pasos-con-piezas.json` | El paso *Accesorios* usa el efecto `hide`: "Sin accesorios" **hace desaparecer la repisa y los ganchos del modelo** y baja el precio (no lleva ese componente). Incluye un paso **dependiente** (el color de los accesorios solo se ofrece si los lleva). |

Los tres conviven en el mismo demo: puedes tener un producto con precio
calculado, otro con recargos y otro que se arma por piezas.

**Orden para los modos A y C**: crear los componentes (`componentes.json`) →
`UPSERT_PRODUCTO` con los `baseComponents` que indica el propio archivo →
aplicar los pasos. Los márgenes salen de la pestaña **Parámetros** (por tipo o
el global), así que el precio de venta se calcula solo.
