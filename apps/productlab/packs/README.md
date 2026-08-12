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

## Qué hace falta para que un producto se pueda VENDER

Los pasos de estos packs son **acabados** (no suman costo). Para que el precio
salga de la realidad, dale al producto sus **componentes base** en el Paso 00
(la plancha de terciado, herrajes, mano de obra) — o pon `priceDelta` en los
acabados premium. Sin eso el producto se ve y se configura, pero se publica con
el precio que tenga en la tienda.
