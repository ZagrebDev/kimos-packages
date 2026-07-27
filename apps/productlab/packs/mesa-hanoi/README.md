# Pack Mesa Hanoi — del personalizador 3D a la app

Todo lo necesario para reproducir **exactamente** la visualización de la Mesa
Hanoi del personalizador 3D dentro de **Gestión Avanzada de Productos**, y
además dejarla vendible en la tienda con precios reales.

## Contenido

| Archivo | Qué es |
|---|---|
| `mesa_hanoi.glb` | El modelo (369 KB, meshopt). Materiales: `Pino`, `Pino_-_Brillante`, `Travesano` |
| `wood_col.webp` | Textura de veta de roble (610 KB, CC0 Poly Haven). La usan **ambos** acabados |
| `model3d.json` | Payload listo para la tool `SET_MODEL3D` del agente |
| `pasos.json` | Payload listo para `SET_PRODUCTO_STEPS` (acabados como pasos del configurador) |
| `mesa_hanoi_pack2.glb` | **Pack de 2 unidades** (371 KB): dos taburetes lado a lado, cada uno con sus propios materiales |
| `model3d-pack2.json` | Payload `SET_MODEL3D` del pack de 2, con sus 4 partes |
| `build-pack2.mjs` | Script que genera el GLB de 2 unidades desde el de 1 |

---

## Opción A — con el agente (rápido)

1. **Crea el producto** "Mesa Hanoi" en la app (pestaña Productos).
2. **Sube los dos archivos**: editor del producto → pestaña **Visor 3D** →
   activar → *Subir .glb*. Para la textura: sección **Acabados** → crea un
   acabado y usa el campo *Textura* para subir `wood_col.webp`. Copia las dos
   URLs que quedan (`…/api/public/files/imagenes/gestion-productos/…`).
3. Abre `model3d.json`, reemplaza las dos URLs y pásale el contenido al agente:
   *"Aplica este SET_MODEL3D"* + el JSON.
4. Igual con `pasos.json` → *"Aplica este SET_PRODUCTO_STEPS"*.

## Opción B — a mano (mismos valores)

### Pestaña Visor 3D

| Campo | Valor |
|---|---|
| Archivo del modelo | URL de `mesa_hanoi.glb` |
| Rotación X | `-1.5707963268` (−π/2) |
| Rotación Y | `0` |
| Rotación Z | `3.1415926536` (π) |
| Reflejar en el eje X | ✅ sí |
| Publicar el 3D en la tienda | ✅ sí (si quieres que lo vea el comprador) |

> La rotación y el espejo corrigen la orientación con que salió el modelo del
> CAD. Sin ellos la mesa aparece tumbada.

### Partes

Al cargar el modelo, la app detecta los tres materiales y los muestra como
chips. Crea **dos** partes (no tres):

| Parte | Materiales | Color por defecto | Acabado por defecto | Veta vertical | Inclinación | Veta a lo largo |
|---|---|---|---|---|---|---|
| Superficie | `Pino` | `#c8a165` | Natural | no | `0` | — |
| Estructura | `Pino_-_Brillante, Travesano` | `#8a6642` | Natural | ✅ sí | `0.24` | `Travesano` |

> **Por qué la estructura es especial**: las patas van inclinadas, así que su
> veta corre vertical y sigue el eje de la pata (inclinación `0.24` rad). El
> travesaño, en cambio, es horizontal: por eso va en *"Materiales con veta a lo
> largo"*, que anula la vertical y la inclinación solo para esa pieza.

### Acabados

| Acabado | Tinte | Textura | Rugosidad | Escala de textura | Veta en el brillo | Triplanar |
|---|---|---|---|---|---|---|
| Natural | `#ffffff` | `wood_col.webp` | `0.7` | `0.09` | `0.3` | ✅ |
| Carbonizado | `#3f4147` | `wood_col.webp` | `0.4` | `0.09` | `1.0` | ✅ |

> Los dos acabados comparten la **misma** textura: lo que cambia es el tinte
> que se multiplica encima. Por eso el carbonizado conserva el grano de la
> madera en vez de quedar como un plástico negro.
>
> *Veta en el brillo* (`grain`) hace que la luminancia de la veta module la
> rugosidad. En el carbonizado va a `1.0` porque, con un tinte casi negro, el
> grano solo se lee en los reflejos.
>
> *Triplanar* ignora las UVs del CAD (que tilean por cara) y proyecta la veta
> de forma continua en el espacio del objeto. Con el Hanoi es obligatorio.

### Pasos del configurador

Crea dos pasos, uno por parte, cada uno con los valores *Natural* y
*Carbonizado*. En cada valor añade un **Efecto 3D**:

```
Acabado de la superficie → Natural      → [Superficie] [acabado] [Natural]
Acabado de la superficie → Carbonizado  → [Superficie] [acabado] [Carbonizado]
Acabado de la estructura → Natural      → [Estructura] [acabado] [Natural]
Acabado de la estructura → Carbonizado  → [Estructura] [acabado] [Carbonizado]
```

Si prefieres un solo paso que cambie toda la mesa a la vez, crea un único paso
"Acabado" y dale a cada valor **dos** efectos (uno por parte).

---

## Pack de 2 unidades

`mesa_hanoi_pack2.glb` resuelve el caso "vendo dos taburetes en un solo
producto y el cliente elige el acabado de cada uno".

**Por qué hace falta un GLB aparte**: en la app cada *parte* se identifica por
los nombres de material del archivo. Si se repitiera el mismo modelo, las dos
unidades compartirían los materiales `Pino` / `Travesano` y elegir el acabado
de la unidad 2 repintaría también la 1. En el pack cada unidad tiene los
suyos (`Pino_1` … `Travesano_2`), así cada paso controla su unidad.

No pesa el doble: las mallas nuevas apuntan a los **mismos** datos de
geometría, así que el archivo pasa de 369 KB a 371 KB (3 geometrías y 28.664
vértices, exactamente los del original).

### Receta

```
1) UPSERT_PRODUCTO { producto: "Pack 2 Hanoi", priceMode: "fixed", fixedPrice: 100000 }
2) SET_MODEL3D     ← model3d-pack2.json (con las URLs reemplazadas)
3) BUILD_3D_STEPS  { producto: "Pack 2 Hanoi" }
```

El paso 3 genera los 4 pasos —Superficie Hanoi 1, Estructura Hanoi 1,
Superficie Hanoi 2, Estructura Hanoi 2— cada uno con sus valores *Natural* y
*Carbonizado* y el vínculo 3D ya hecho. Con precio fijo, las 16 combinaciones
valen $100.000. En la UI el equivalente es el botón **⚡ Generar pasos desde
el modelo 3D**.

### Regenerarlo o hacer otros packs

```bash
node build-pack2.mjs                          # 2 unidades del Hanoi
node build-pack2.mjs otro.glb salida.glb --gap 1.3
```

`--gap` es la separación entre centros en anchos de la pieza (1 = pegadas).
El script mide el modelo respetando la cuantización de `KHR_mesh_quantization`
y separa las unidades sobre el eje horizontal.

---

## Lo que cambia respecto al personalizador (y por qué)

El personalizador es un visor: eliges acabado y lo ves. Esta app además tiene
que **cobrarlo** — pero eso no obliga a modelar costos:

- Si el acabado **no cambia el precio**, deja los valores sin componentes: son
  opciones que no agregan costo y se publican igual a la tienda.
- Si quieres **cobrar** por un acabado sin llevar su costo en detalle, ponle un
  **recargo** al valor (`priceDelta`).
- Si quieres **control de rentabilidad**, crea los componentes (`Barniz
  natural`, `Tinte carbonizado`) con su costo de proveedor y asígnalos: ahí el
  precio sale de los costos y las reglas de margen.

`pasos.json` referencia componentes de ejemplo; si no los tienes creados,
bórralos del payload y los valores quedan sin costo (la opción más simple).

El único caso que sí queda fuera de la tienda es un valor que **declara**
alternativas pero las tiene todas inactivas o sin stock — eso es un problema
real de disponibilidad, no una opción gratis.

## Verificación

- La mesa se ve **de pie** y encuadrada → rotación y espejo bien.
- Cambiar a *Carbonizado* oscurece la madera **conservando el grano** →
  triplanar y `grain` bien.
- La veta de las patas corre **a lo largo de la pata** (inclinada) y la del
  travesaño **a lo largo del travesaño** → `grainVertical`, `grainAngle` y
  `grainAlongMaterials` bien.
- El panel PRECIO de abajo muestra las variantes → los componentes están
  enlazados y el producto es vendible.

## Origen de los archivos

Salen del repo del personalizador 3D (`public/models/`, `public/textures/`),
producidos por su pipeline: STEP de CAD → MayoConv → asignación de materiales
por parte → `gltf-transform` (weld → simplify → meshopt + WebP). Si preparas
modelos nuevos, ese pipeline sigue siendo el camino: lo único que la app
necesita es un **GLB con los materiales bien nombrados**, porque el nombre del
material es lo que amarra cada pieza a su parte.
