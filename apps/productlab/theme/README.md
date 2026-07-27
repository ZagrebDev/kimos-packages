# Kimos 3D para el theme de Jumpseller

Muestra en la ficha de producto de tu tienda el modelo 3D configurado en la app
**Gestión Avanzada de Productos**, y lo repinta **en vivo** cuando el cliente
cambia las opciones (acabado, color, etc.).

Probado de punta a punta con Chromium sobre una réplica de un theme real:
carga el modelo, y al cambiar "Superficie Hanoi 1" a *Carbonizado* oscurece
solo esa pieza de esa unidad, dejando el resto intacto.

---

## No hay que editar plantillas

La integración se engancha a `.prod-options`, la clase que Jumpseller usa para
los selects, botones y swatches de opciones en cualquier theme, y lee el
producto del `<script class="product-json">` que el theme ya imprime.

El arranque va en `assets/custom.js`, que el theme ya carga en todas las
páginas — así que **no se toca ningún `.liquid`**.

## Dos modos

| Modo | Qué hace | Cómo se activa |
|---|---|---|
| **Ficha completa** | Reemplaza la ficha del theme por la de KIMOS: barra con pestañas, heros del builder, configurador con 3D, especificaciones y fotos. Como en computadores. | `window.KIMOS_FULL = true` |
| **Solo visor 3D** | Tu ficha sigue igual; se añade un botón "Ver en 3D" sobre la galería. | `window.KIMOS_FULL = false` |

En ambos casos **el precio y el carro siguen siendo los del theme**. La ficha
completa no calcula precios ni arma su propio carro: al elegir un valor escribe
en los controles nativos del producto (`.prod-options`) y dispara su `change`,
y el botón de la barra pulsa el botón de carro real. Así el precio cobrado es
siempre el de la variante en Jumpseller y no hay dos fuentes de verdad.

## Contrato v2 (ProductLab)

La app (antes *gestion-productos*, ahora **ProductLab**) publica su JSON con
`version: 2`. El kit (configurador **v5.0.0**) consume v1 y v2 por la misma
vía: todos los campos nuevos son opcionales y sin ellos la ficha se comporta
exactamente como antes. También acepta `data.productos` o el alias antiguo
`data.equipos`.

### Pasos dependientes (`groups[].dependsOn`)

Un paso puede declarar `dependsOn: { groupId, valueIds: [] }`: solo se muestra
si la selección **actual** del paso `groupId` está en `valueIds` (ej.: "Tarjeta
de video" solo con la placa que la admite). Qué hace la ficha:

- Un paso oculto **no se pinta** (los visibles se renumeran) y se **fuerza a su
  valor por defecto** (`isDefault`) también en el control nativo
  (`.prod-options` + `change`): el theme casa la variante con TODOS los
  controles, así que un oculto desincronizado cobraría lo que no se ve.
- Las **cadenas** (A oculta a B, y B oculta a C) se re-evalúan hasta
  estabilizar, con tope de pasadas.
- Si un cambio del cliente fuerza ajustes, se avisa con un cartel discreto
  ("Ajustado automáticamente: …"). El ajuste al cargar es silencioso.

### Estilo por producto (`storefront.style`)

`{ accentColor, bgColor, radius, cardStyle, showDeltas, stepsCollapsed }`:

| Campo | Efecto en la ficha |
|---|---|
| `accentColor` | Variable `--kc-accent`: pestaña activa, borde de la card elegida, número de paso y botón primario (con texto en `--kc-accent-fg` según contraste). |
| `bgColor` | Fondo del área del configurador; el modo claro/oscuro se recalcula sobre él. |
| `radius` | Variable `--kc-radius` en cards y botones (0 = esquinas rectas, como el previsualizador de la app). Sin `style` (v1) quedan los radios de siempre. |
| `cardStyle` | `cards` (default) · `list` (una fila por valor, texto a la izquierda) · `compact` (cards pequeñas y densas). |
| `showDeltas` | `delta` (default): diferencia contra lo elegido (`+ $200.000`) · `total`: precio **absoluto** de la variante candidata (precio server-side de la variante actual del theme + diferencia de deltas) · `none`: sin precio en las cards. |
| `stepsCollapsed` | Todos los pasos parten plegados salvo el primero visible; cada cabecera pliega/despliega y muestra lo elegido. |

### Secciones e imágenes con alto natural

- Sección **`imagen`** (repetible): `{ kind:'imagen', imageUrl, alt, width,
  link }`. Se pinta a lo ancho con su **alto natural** (sin recortes);
  `width:'full'` sangra hasta el borde del viewport (`margin: calc(50% -
  50vw)`); con `link` la imagen entera es un enlace.
- Los bloques de hero **`photo`** y **`gallery`** aceptan `size:'auto'` (alto
  natural, `max-width: 100%`), y el hero acepta `height:'auto'` (crece con su
  contenido, altura mínima pequeña).

### Cantidad por valor (`values[].qty`)

Informativo: con `qty > 1` la card muestra un multiplicador discreto `×N`
junto al nombre (ej. memoria "8 GB ×2"). El precio sigue siendo el de la
variante del theme.

## AR en vivo (8th Wall Engine)

La vía preferente de "Ver en tu espacio" en el móvil: la cámara en la propia
página y encima el producto EXACTO del configurador — mismo objeto, mismos
materiales, así que cambiar un color cambia el AR al instante. Markerless
(SLAM del binario) y **con paridad total**: iPhone y Android, cualquier
navegador con cámara. Verificado de punta a punta en Chromium con cámara
sintética: el motor arranca sin UNA sola petición externa y el producto
aparece en su escena con el color elegido.

Se activa en `custom.js`:

```js
window.KIMOS_XR8_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';
```

- El motor (~2,1 MB gzip: `xr.js` + el chunk `xr-slam.js`) **solo se descarga
  al pulsar el botón**. Vacío (`''`) lo desactiva.
- También puede autoalojarse: sube `xr.js` y `xr-slam.js` a cualquier hosting
  con CORS (por ejemplo la plataforma KIMOS) y apunta la URL ahí. No llama a
  ningún servidor de 8th Wall/Niantic.
- Si el motor falla (cámara denegada, descarga, dispositivo), la ficha cae
  sola a los visores del sistema: **Scene Viewer** en Android (con el color
  elegido vía el endpoint del backend) y **AR Quick Look** en iPhone.
- Licencia del binario: MIT para el framework, pero el binario del SLAM va
  bajo licencia de uso limitado de Niantic Spatial, **revocable**, que exige
  atribución — la capa del AR muestra "AR: 8th Wall Engine © Niantic
  Spatial" por eso. Los visores del sistema quedan siempre de respaldo por si
  esa licencia cambiara.

Prueba: `node theme/test/run-ar-vivo.mjs` (necesita `npm i @8thwall/engine-binary`).

## Fotos y descripción del producto

La ficha **no depende de lo que el theme llegue a pintar**. La app publica en
su JSON la galería completa (`images[]`) y la descripción del producto en la
tienda (`description`), leídas del producto real por el backend. La ficha usa
esa galería y añade detrás lo que encuentre en el DOM.

Eso resuelve el caso típico: el carrusel del theme trae la primera foto en
`src` y las demás en `data-src` hasta que se desliza, así que raspar el DOM
solo daba **la foto principal**.

La descripción se incrusta donde tú quieras con el bloque **Descripción del
producto** del builder de heros (tamaño y recorte a N caracteres). No se copia:
se lee viva, así que editarla en Jumpseller actualiza la ficha sola.

Además, un producto **recién creado ya trae un hero de arranque** (nombre,
descripción, foto y botón *Configurar*), para que la pestaña Explorar no salga
vacía. Se siembra una sola vez: si lo borras, no vuelve.

## "Ver en tu espacio" — orden de las vías

1. **AR en vivo (8th Wall)** si `KIMOS_XR8_URL` está configurada y el
   dispositivo tiene cámara: iPhone y Android por igual, con los colores
   elegidos al instante. Es la vía preferente.
2. **Visores del sistema**, si el motor falla o está desactivado:
   - Android → Google Scene Viewer. El backend sirve el `.glb` YA parcheado
     con la configuración (`/ar/{producto}.glb?m=Material:color`), así que
     también refleja lo elegido. Requiere el modelo generado desde la app
     (Visor 3D → "Generar y subir") y los Servicios de Google para RA.
   - iPhone → AR Quick Look, con un `.usdz` generado en el navegador desde la
     escena configurada, veta incluida (se hornea la proyección como UV).
3. **QR** en escritorio, que abre esta misma ficha en el configurador del
   móvil (`?kimos_ar=1`).

Todas sin marcador, sobre el suelo real y a tamaño real. El único requisito
del producto es la **medida real** (app → Visor 3D → "Medida real del lado
más largo, en cm"; se publica como `model3d.realSizeCm`). Sin ella no se
ofrece AR: colocar un mueble a escala inventada engaña al cliente.

## Instalación (4 archivos)

En Jumpseller: **Diseño → Editar código → Assets**.

| Archivo | Acción |
|---|---|
| `kimos-engine3d.js` | Subir (motor three.js + exportadores AR, 860 KB / 222 KB gzip) |
| `kimos-configurador.js` | Subir (ficha completa: pestañas, heros, pasos, specs) |
| `kimos-configurador.css` | Subir (estilos de la ficha completa) |
| `kimos3d.js` | Subir (modo solo visor 3D) |
| `kimos3d.css` | Subir (estilos del visor) |
| `custom.js` | **Reemplazar** el tuyo por este (trae tu contenido original al final) |
| `diagnostico.js` | No se sube: es para pegar en la consola si algo falla |

Luego edita `custom.js` y pon tu URL pública, la que da la app en la pestaña
**Publicación**:

```js
window.KIMOS_3D_URL = 'https://TU-KIMOS.kimos.dev/api/public/app/TU-INSTANCIA/definition';
```

Si ya tenías cosas en tu `custom.js`, pégalas al final del archivo nuevo.

## Si subes un archivo nuevo y no cambia nada

El navegador y el CDN cachean **por URL**. Los tres assets de la ficha los
inyecta `custom.js`, y la URL lleva una marca `?kv=…` que sale de
`window.KIMOS_ASSET_V`. Mientras esa marca no cambie, la URL es idéntica y se
sigue sirviendo la copia guardada — da igual lo que subas.

Cómo comprobarlo: **borra** los archivos de Assets y recarga la ficha. Si sigue
funcionando, estás viendo la caché.

**Cada vez que subas assets nuevos, sube también el número:**

```js
window.KIMOS_ASSET_V = '2';   // en custom.js
```

Sin tocarlo, los cambios entran solos al día siguiente (la marca por defecto
cambia cada día).

> Esto antes estaba mal: `custom.js` le pegaba a los otros archivos **su
> propio** `?timestamp`. Como al actualizar la ficha no se toca `custom.js`,
> ese valor no cambiaba nunca y las versiones nuevas no llegaban jamás.

## Jumpseller renombra los assets

Importante: Jumpseller **minifica y renombra** los archivos del theme. La
plantilla pide `custom.js` y el servidor entrega `custom.min.js?1784967522`.
Por eso `custom.js` deduce el nombre de los demás a partir de cómo llegó él
mismo (si vino minificado, los otros también) y prueba el otro nombre como
respaldo. Pedir el que no existe da 404 y el script no llega a ejecutarse
nunca — sin errores llamativos.

Sube los archivos con su nombre normal (`kimos3d.js`, `kimos3d.css`,
`kimos-engine3d.js`); del renombrado se encarga Jumpseller.

## Plan B: cargar los assets desde el theme (más robusto)

`custom.js` deduce la carpeta de assets a partir de su propia URL. Funciona en
los themes probados, pero si Jumpseller sirve los archivos desde otra ruta,
los `<script>` inyectados dan 404 y no pasa nada (síntoma: "no se ve el
visor", sin errores llamativos).

La alternativa a prueba de balas es dejar que el propio theme resuelva las
URLs con su filtro `asset`. En `templates/layout.liquid`, junto a la línea que
ya carga `custom.js`, añade:

```liquid
<link rel="stylesheet" href="{{ 'kimos3d.css' | asset }}">
<script src="{{ 'kimos3d.js' | asset }}" defer></script>
```

Y en `custom.js`, además de la URL, indica dónde está el motor y borra el
bloque de auto-carga (el que dice "no tocar"):

```js
window.KIMOS_3D_ENGINE_URL = "{{ 'kimos-engine3d.js' | asset }}";
```

Ojo: esa línea con `{{ … }}` solo funciona si Jumpseller procesa Liquid en
`custom.js`. Si no lo hace, pega la URL literal del archivo (cópiala del
navegador tras subirlo a Assets).

## Opciones

```js
window.KIMOS_3D_URL      = '…/definition';  // obligatoria
window.KIMOS_3D_LABEL    = 'Ver en 3D';     // texto del botón
window.KIMOS_3D_AUTOLOAD = false;           // true = abrir sin esperar clic
```

## Cómo se comporta

- **Un producto sin 3D publicado no se entera de nada**: no se inserta UI ni se
  descarga el motor. Solo actúa sobre los productos que en la app tienen
  *"Publicar el 3D en la tienda"* marcado.
- El motor (155 KB gzip) se descarga **solo al pulsar "Ver en 3D"**, así que no
  pesa en la carga de la tienda. Con `AUTOLOAD` en true baja al entrar.
- El visor se inserta arriba de la galería de fotos, con un botón para cerrarlo
  y volver a las fotos.
- El JSON público se cachea 3 minutos en `sessionStorage` y se pide con un
  `_t` rotatorio de 5 minutos, para no pelear con el caché del CDN.

## Requisito de la app

En la app, el producto debe tener:

1. **Visor 3D** activo con su `.glb`, sus partes y sus acabados.
2. **"Publicar el 3D en la tienda"** marcado.
3. Los pasos vinculados al 3D (botón *⚡ Generar pasos desde el modelo 3D*, o
   la tool `BUILD_3D_STEPS` del agente).
4. El producto **aplicado a la tienda**, para que las opciones existan en
   Jumpseller con los mismos nombres que los pasos.

El emparejamiento es por **id de Jumpseller** (o SKU como respaldo), y cada
opción se cruza con su paso **por nombre** — que coinciden porque la app genera
las opciones a partir de las etiquetas de los pasos.

## Verificación en producción

El `.glb` y las texturas se sirven desde KIMOS, que es otro dominio que el de
la tienda, así que la carga cruzada depende de CORS. El backend lo trae
abierto por configuración (`ALLOWED_ORIGINS=*`), pero conviene confirmarlo una
vez desde la consola del navegador **en la tienda**:

```js
fetch('https://TU-KIMOS.kimos.dev/api/public/app/TU-INSTANCIA/definition')
  .then(r => r.json()).then(d => console.log('OK', d.data.productos.length));
```

Si diera error de CORS, hay que abrir el origen de la tienda en
`ALLOWED_ORIGINS` del backend.

## Diagnóstico

**Si algo no aparece, no adivines**: abre la ficha del producto en tu tienda,
abre la consola del navegador (F12) y pega el contenido de `diagnostico.js`.
Revisa capa por capa —custom.js, assets, JSON público, CORS, emparejamiento
del producto, nombres de las opciones— y te dice en cuál se corta la cadena.
Funciona aunque los scripts del visor no hayan llegado a cargar.

Si el visor sí cargó, también tienes `kimos3d.diag()` en la consola.

### Comprobar qué versión está sirviendo la tienda

Jumpseller minifica y cachea los assets (`kimos3d.min.js?1784967522`), así que
tras subir una versión nueva puede seguir sirviéndose la anterior. Un síntoma
típico es que **no aparezca ninguna línea `[kimos3d]`** en la consola: las
versiones antiguas se rendían en silencio.

```js
kimos3d.version   // → "1.2.0" si está la actual; undefined si es una previa
```

Y si `kimos3d` ni siquiera existe, para ver qué archivo se está sirviendo:

```js
(async()=>{const s=[...document.scripts].find(s=>/kimos3d/.test(s.src));
if(!s)return console.log('kimos3d.js NO está cargado');
const t=await(await fetch(s.src)).text();
console.log(s.src,'\n→',/product-form-json/.test(t)?'versión ACTUAL':'versión ANTIGUA: vuelve a subirla');})()
```

Referencia rápida de lo que registra (prefijo `[kimos3d]`):

| Síntoma | Causa probable |
|---|---|
| No aparece el botón | El producto no tiene 3D publicado, o el id/SKU no coincide con el de la app |
| "No se pudo mostrar el 3D" | El `.glb` no carga: revisa la URL y el CORS |
| El 3D no cambia al elegir | Los nombres de las opciones en Jumpseller no coinciden con los pasos: vuelve a aplicar el producto desde la app |
| No pasa nada de nada | Falta `KIMOS_3D_URL`, o `custom.js` no se está cargando |

---

## Pruebas

`test/` trae el harness con el que se validó, sobre una réplica de la ficha de
producto de un theme real:

```bash
node test/gen-definition.mjs   # genera definition.json con la APP REAL
node test/run.mjs              # abre Chromium, carga el 3D y cambia una opción
node test/run-ficha.mjs        # ficha completa: galería, descripción y pestañas
node test/run-contrato-v2.mjs  # contrato v2 OFFLINE (jsdom, sin navegador)
```

`run-contrato-v2.mjs` valida el contrato v2 sin navegador ni red: pasos
dependientes (con cadenas y forzado del default en los selects nativos),
`storefront.style` (accent/radius/cardStyle/showDeltas/stepsCollapsed),
secciones `imagen`, hero/photo `auto`, `qty` y la degradación con JSON v1
(alias `equipos` incluido). Necesita `jsdom` (solo de pruebas: `npm i jsdom`,
o `NODE_PATH` apuntando a un `node_modules` que lo tenga).

`run-ficha.mjs` reproduce el caso real que se dio en la tienda —theme oscuro,
JSON del theme con una sola foto y el resto en `data-src`— y comprueba que la
ficha muestre las tres fotos publicadas y la descripción dentro del hero.

`gen-definition.mjs` no escribe el JSON a mano: monta la app y publica, de modo
que el harness consume exactamente el contrato que la app produce. Si el
contrato cambiara, la prueba lo detecta.

El script deja `shot-natural.png` y `shot-carbonizado.png` para comparar a ojo.
Necesita los assets en la carpeta del test (`kimos*.js`, `kimos3d.css`, el
`.glb` y la textura); están en `.gitignore` porque son copias.
