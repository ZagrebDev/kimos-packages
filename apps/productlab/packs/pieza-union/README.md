# Pack Pieza de Unión — del personalizador a ProductLab

Mueble infantil de **terciado de abedul** (19 cm de lado mayor, medido del GLB).
Partes tintables: **Madera** · 6 acabados.

| Archivo | Qué es |
|---|---|
| `model3d.json` | Payload de `SET_MODEL3D` (partes, acabados, rotación y `realSizeCm` → AR) |
| `pasos.json` | Payload de `SET_PRODUCTO_STEPS` (un paso por parte, un valor por acabado) |

**Archivos que hay que subir** (viven en el repo `personalizador`):
`public/models/pieza_union.glb` y `public/textures/plywood_col.webp` (una sola vez, sirve para todos).

## Pasos del demo

1. **Crear el producto** `Pieza de Unión` en ProductLab (pestaña Productos → + Añadir).
2. **Pestaña Visor 3D** → activar → **Subir .glb** (`pieza_union.glb`). Copia la URL.
3. En **Acabados**, sube `plywood_col.webp` una vez y copia su URL.
4. Reemplaza en `model3d.json` las dos URLs `REEMPLAZAR_…` y pásaselo al agente:
   *"Aplica este SET_MODEL3D"* + el JSON. (O llena la pestaña a mano con esos valores.)
5. Lo mismo con `pasos.json`: *"Aplica este SET_PRODUCTO_STEPS"*.
   → El Estudio ya muestra el modelo repintándose al cambiar de paso.
6. **Publicar** (y *Aplicar a la tienda* si quieres venderlo). En el móvil aparece
   **Ver en tu espacio** (AR) porque `realSizeCm` viene declarado.

> Precio: estos pasos son acabados (no suman costo). Para vender, dale al producto
> sus **componentes base** (la plancha, los herrajes, la mano de obra) en el Paso 00,
> o pon `priceDelta` en los acabados premium.
