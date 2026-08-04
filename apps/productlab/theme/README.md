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

## Barra y fotos, configurables desde la app

Todo lo visible se decide en ProductLab (Ficha → Estilo) y viaja en
`storefront.style`; el kit solo lo aplica:

| Ajuste | Campo |
|---|---|
| Fondo y color de texto de la barra | `style.bar.bgColor` / `bar.textColor` (el texto se calcula por contraste si no lo fijas) |
| Ancho de la barra | `style.bar.width` (`auto` / `container` / `full`) |
| Barra fija al hacer scroll | `style.bar.sticky` (la barra es `position: fixed`, no sticky: dentro de un theme con `overflow` en algún ancestro, sticky se va con el scroll) |
| Separación extra bajo el menú del sitio | `style.bar.offset` (px; **deja 0**: el alto del menú se mide solo y este valor se SUMA encima) |
| Pestañas secundarias en móvil | `style.bar.mobileTabs` (por defecto **ocultas**: se amontonaban con el precio y engordaban la barra) |
| Precio y miniatura en la barra | `style.bar.showPrice` / `bar.showThumb` |
| Galería en Explorar | `style.photos`: `layout` (`visor`/`lado`/`mosaico`), `size` (ancho del bloque), `mainSize` (alto de la foto grande, incluido `auto`), `thumbSize`, `cols`, `fit` (`contain`/`cover`) y `frame` |
| Color del spinner de arranque | `style.spinnerColor` (vacío = el acento). Para el primer fotograma, antes de que llegue nada de KIMOS: `window.KIMOS_SPINNER_COLOR` y `window.KIMOS_BOOT_BG` en `custom.js` |
| Texto del botón que lleva al configurador | `style.buyLabel` (vacío = "Configurar"); va en el ESTILO para cambiarlo de una vez en todos los productos de una plantilla, y `storefront.tabs.comprar` lo pisa para un producto suelto |

**Contraste garantizado:** `--kc-accent` tiene un valor sólido por defecto y
nunca cae a `currentColor` — eso dejaba el botón blanco sobre blanco dentro de
un hero con texto claro. `style.accentColor` lo sobreescribe.

## Sistema visual (y de dónde sale cada color)

El dibujo es el de la ficha de computadores —plano, filetes rectos, acento
fuerte, la tipografía del sitio— pero sin nada cableado. Cada token se
resuelve en tres escalones y **gana el primero que exista**:

1. **ProductLab** (`storefront.style`): el JS escribe las variables inline en
   la raíz de la ficha, así que lo que definas en la app manda siempre.
2. **El bundle del theme**: `--color-links` (acento), `--color-main` (texto),
   `--color-background`, `--font-main`, `--font-secondary`. Si tu theme los
   expone, la ficha adopta la paleta y las tipografías del sitio sola.
3. **El valor de reserva del kit**, para que en un theme que no exponga nada
   la ficha siga siendo legible.

| Token | Para qué |
|---|---|
| `--kc-accent` / `--kc-accent-fg` | acento (pestaña activa, `+`, botón, filetes) y su color de texto |
| `--kc-bg` / `--kc-fg` | fondo y texto de la ficha (se miden del theme si no los fijas) |
| `--kc-line` | filetes finos: tablas, separadores, borde inferior de la barra |
| `--kc-borde` | bordes de piezas: cards de los pasos, miniaturas |
| `--kc-plata` | fondo de las cajas de imagen (cards, visor de fotos) |
| `--kc-gris` | texto secundario (descripciones, "desde", contador) |
| `--kc-radius` | radio de esquinas; **0 = plano** (`style.radius`) |

Los tres derivados (`--kc-borde`, `--kc-plata`, `--kc-gris`) se recalculan
según el fondo real: en una tienda de fondo oscuro pasan a tonos claros
translúcidos, así que el mismo kit contrasta igual en ambos casos.

La barra **hereda el estilo general**: sin `bar.bgColor` propio usa el fondo y
el texto de la ficha, y siempre toma de ella el acento (pestaña activa, botón)
y el radio.

## Plantillas de estilo (un look en muchos productos)

El aspecto se define UNA vez en la pestaña **Estilos** de la app (plantillas
del catálogo) y cada producto solo elige cuál aplicar en *Ficha de tienda*.
**El kit no sabe nada de esto**: el JSON público ya trae `storefront.style`
resuelto por producto, así que el theme no cambia.

## No dejes conviviendo el configurador antiguo

Si la tienda venía del theme de computadores, tendrá `assets/configurador.js`
y `configurador.css` cargados desde la rama `diseno=personalizado` de
`components/product-template.liquid`. **Los dos configuradores se montan a la
vez**: barra duplicada, descripción anidada y estilos peleándose. Al instalar
este kit:

1. Borra `assets/configurador.js` y `assets/configurador.css`.
2. Deja `components/product-template.liquid` con su rama estándar (sin la
   vista personalizada). Este kit no necesita tocar ningún `.liquid`.

## Arranque: velo con spinner hasta que la ficha está lista

Al entrar en un producto se veían, en este orden: la ficha del theme unos
segundos, el cambiazo a la de KIMOS y el hero sin su foto hasta que cargaba.
Ahora `custom.js` pinta desde el primer instante un velo a pantalla completa
con un spinner (estilos en línea: el CSS del kit llega después) y el
configurador lo retira **cuando ya ha pintado Y sus imágenes han cargado** —
las de la ficha y los fondos de los heros, que se precargan aparte porque no
son `<img>` y nadie los espera. Se va fundiéndose, no de golpe.

Detalles que importan:

- El velo solo aparece en fichas de producto, y se retira **al instante** (sin
  fundido) si no hay nada que reemplazar: producto sin ficha KIMOS, JSON
  inaccesible o error al montar.
- Adopta el color de fondo real de la página y, en cuanto el configurador
  mide el menú del sitio, se coloca por debajo de él: se espera con la tienda
  a la vista, no con una pantalla en blanco. El spinner toma el acento del
  producto.
- Topes: la espera de imágenes es de 4 s (`window.KIMOS_BOOT_MAX` para
  cambiarlo) y `custom.js` retira el velo pase lo que pase a los 9 s. Una foto
  que no llega nunca puede dejar la tienda tapada.
- El visor 3D **no** se espera: se carga solo al entrar en *Configurar*, y
  bloquear la ficha por él sería peor que el problema que arregla.

## La ficha arranca pegada a la barra

Los themes dejan aire encima de la sección de producto (padding o margen, para
separarla del menú). Como nuestra barra va fija, ese aire quedaba como un hueco
entre la barra y el hero. El kit lo quita al montar, pero **solo donde la ficha
es lo primero que hay**: recorre hacia arriba mientras siga siendo el primer
hijo y anula ahí el `padding-top`/`margin-top`. Si encima queda algo del theme
(migas de pan, un aviso), su espacio no se toca.

## La galería son las fotos DEL PRODUCTO

La sección *Fotos* usa la galería que publica KIMOS (`productos[].images`), que
el backend lee de la ficha real de la tienda. **No se mezcla con lo que haya en
el DOM**: ahí el theme imprime también las fotos de las variantes —los colores
del gabinete, por ejemplo— y acababan colándose como si fueran del producto. El
raspado del DOM queda solo de respaldo, para cuando no hay galería publicada.

## Bajar a una sección sin que la barra tape el título

Las pestañas *Fotos* y *Especificaciones* bajan hasta su sección, y entrar en
*Configurar* sube al principio de la ficha. En los dos casos lo que hay que
descontar no es el ALTO de la barra sino **dónde termina**: va fija bajo el
menú del sitio, así que su borde inferior incluye ese menú y la separación
extra del producto. Con el alto a secas —o con `scrollIntoView` a secas, que es
lo que hacía al entrar en Configurar— el título quedaba detrás de la barra.

## El panel de compra en móvil

Baja a una barra fija **al ras del borde inferior de la PANTALLA** (respetando
el área segura del teléfono), esté el scroll donde esté — también sobre el pie
de página. Reparto: la foto a la izquierda y, a su derecha, nombre, precio y
entrega; el botón de carro debajo, a todo el ancho. La flecha lo despliega
hacia arriba y muestra la foto grande y **todo lo elegido, paso por paso**.

Dos cosas que hacen que eso funcione de verdad:

- **El panel también se muda a `<body>`** cuando un ancestro del theme rompe
  `position: fixed` (transform/filter/will-change/contain). Sin eso quedaba
  pegado al borde inferior de la SECCIÓN del configurador — flotando a media
  pantalla y tapando los pasos, que es exactamente lo que se veía.
- **El hueco al pie de los pasos es el alto REAL del panel**, medido por el JS
  y expuesto en `--kc-panel-h`. Con un número fijo, el panel se comía las
  últimas opciones en cuanto crecía (precio largo, aviso de stock, desplegado).

Con el panel viviendo en `<body>`, fuera de la vista *Configurar* se esconde a
mano: el repintado del cuerpo de la ficha ya no lo alcanza.

## El precio: de la VARIANTE elegida

El precio que enseña la ficha (panel de compra, "desde" de la barra y el modo
`showDeltas: total`) sale de `script.product-json`, la lista completa de
variantes que imprime el theme — la misma que usa él para repintar su precio.
Se busca la variante cuyos valores casan con la selección actual y se toma su
`price_with_discount` (o `price − discount`).

Lo que había antes era `product-form-json`, que **solo trae la primera
variante**: el precio se quedaba clavado en el de arranque por mucho que se
cambiara de paso. Y el "desde" de la barra usa la variante **más barata** de
verdad, no la primera, que es la configuración por defecto y no tiene por qué
ser la mínima.

Sigue en pie la regla de siempre: el precio **no se calcula** aquí, se lee de
lo que la tienda publica. Lo que se cobra es la variante de Jumpseller.

## El botón de carro del theme

Todo lo que la ficha dice sobre disponibilidad —y el propio "Añadir al carro"—
cuelga del **botón real** del theme: es quien sabe de stock, variantes y AJAX.
Encontrarlo tiene trampa, y aquí se pagó cara:

- El primer `<button>` del formulario de Jumpseller es el **`−` del selector de
  cantidad**, que llega deshabilitado con cantidad 1. Cogerlo dejaba el aviso
  *"esta combinación no está disponible"* puesto para siempre y mandaba el clic
  de "Añadir al carro" al menos: al carro no llegaba nada.
- `type="submit"` **no** sirve como pista: el mismo botón se imprime como
  `submit` o como `button` según la configuración del theme
  (`display_cart_notification`).

Se busca por orden de certeza —`#add-to-cart`, `[data-add-to-cart]`,
`[name=add]`, `.add-to-cart`, `.product-form__button`, y ya al final un
`button[type=submit]` dentro del formulario— descartando siempre los controles
de cantidad. Al montar, la consola dice cuál se está usando:

```
[kimos-cfg] botón de carro del theme: button#add-to-cart.button
```

Si tu theme usa otro marcado y ahí aparece "no encuentro el botón de carro",
ese es el dato que hay que añadir a la lista.

## Cuando la tienda y ProductLab no coinciden

La ficha **solo puede ofrecer lo que la tienda tiene**: los valores salen de
las opciones nativas de Jumpseller, porque son las que resuelven la variante y
el precio que se cobra. Si en ProductLab agregas un valor (o un paso) y no
aplicas el producto a la tienda, ese valor no aparece en la ficha y las
combinaciones que lo usan no existen — el theme deshabilita su botón de carro y
el panel dice *"Esta combinación no está disponible por ahora"*.

Al montar, el kit compara ambos lados y, si no cuadran, lo escribe en consola
con nombre y apellido:

```
[kimos-cfg] la tienda y ProductLab no coinciden — "Color" sin Negro en la tienda.
La ficha solo puede ofrecer lo que la tienda tiene…
```

La solución es siempre la misma: abrir el producto en ProductLab y pulsar
**Guardar y aplicar a la tienda**, que crea las opciones y variantes que faltan.

El aviso de disponibilidad es un espejo del botón real del theme, y ese botón
se habilita a su ritmo (resuelve la variante después de que la ficha pinte):
por eso se vigila con un observador y el mensaje se retira en cuanto el theme
puede vender la combinación.

## Valores de relleno en pasos dependientes

Jumpseller exige **un valor de cada opción en cada variante**, así que un paso
oculto por `dependsOn` sigue aportando su valor por defecto. Ese default tiene
que ser un "No aplica" sin costo… y ahí aparece el problema evidente: si además
se pudiera elegir, el cliente que SÍ ve el paso podría comprar sin procesador.

Por eso el contrato v2 marca esos valores con **`fallback: true`**. El kit los
trata así:

- no pinta su card cuando el paso se ve;
- si el paso se abre y el relleno estaba elegido, escribe en el select nativo
  el primer valor real (sin anunciarlo como "ajuste": es lo esperable);
- cuando el paso vuelve a ocultarse, fuerza otra vez el relleno, que es lo que
  mantiene la variante coherente y a precio cero por ese paso.

## Configurar: pasos a la izquierda, panel de compra a la derecha

La vista *Configurar* es la de la ficha de computadores: los pasos ocupan la
columna ancha y a su lado va una caja con la foto del producto (o el visor 3D),
el precio, la entrega estimada, el resumen de lo elegido y el botón de carro.
Esa caja **acompaña al scroll** —se fija con `position: fixed` calculando su
sitio, no con `sticky`— y frena en el borde inferior de la sección para no
invadir el pie. En móvil baja a una barra flotante compacta que se despliega.

El precio del panel se **copia** del theme, no se calcula: la fuente de verdad
sigue siendo la variante de Jumpseller. La entrega sí se calcula, con los días
que publica cada valor (`deliveryMode` decide si suman o van en paralelo) más
los días de preparación.

Dentro de *Configurar* la barra superior no repite la foto ni el precio (ya
están en el panel) y no lleva botón de "volver": para eso está la pestaña del
producto, que es la primera de la barra y lleva su nombre.

## Ancho por sección

Cada sección de la ficha (hero, imagen, especificaciones, fotos, nota, visor
3D) puede llevar su propio ancho, independiente del general: se define en
ProductLab (Ficha → builder, selector *Ancho* de la sección) y el kit lo
aplica con `kc-sec-full` (sangrado a la ventana) o `kc-sec-container`
(centrado al contenedor del theme). Sin valor propio, hereda el de la ficha.

## Encaje con el theme: tope de la barra y ancho

Dos cosas que ningún theme expone y el kit **mide del DOM real** (y recalcula
en scroll/resize, porque muchos headers encogen al bajar):

- **Tope de la barra.** La barra de pestañas va fija; si el theme tiene su
  propio header fijo/sticky, con `top: 0` quedaría tapada. El kit mide **dónde
  termina** ese header (`header, .theme-header, #header`) y lo escribe en píxeles
  sobre la barra — no en variables CSS, que dejan de llegar si la barra tiene
  que mudarse a `<body>`. Medir el *final* y no el principio es lo que hace que
  funcione con una franja de avisos fija encima del menú: ahí el header no
  empieza en 0 y la barra terminaba escondida detrás de él. Si tu header no se
  detecta bien: `window.KIMOS_TOP_OFFSET = 66` (px fijos) o
  `window.KIMOS_HEADER_SELECTOR = '.mi-header'`.

  **`style.bar.offset` se SUMA a esa medida.** Déjalo en 0 salvo que quieras
  separación extra: si lo usas para compensar el alto del menú, acabas con la
  barra el doble de abajo.

- **La barra va SIEMPRE bajo el menú del sitio.** Su `z-index` se calcula: 11
  por defecto y, si el menú declara uno menor, justo por debajo de él. Los
  desplegables del menú caen encima de la barra, que es lo correcto; si algo
  la tapa, el auto-arreglo la sube — pero nunca por encima del menú.

- **Si la barra no aparece, el kit lo dice.** Metro y medio después de montar
  comprueba su propio sitio con `elementFromPoint`; si algo la tapa, lo escribe
  en consola con el elemento y su `z-index`, y si ese elemento declara uno, la
  barra se pone justo por encima. También avisa cuando un ancestro del theme
  rompe `position: fixed` (transform/filter/will-change/contain) y la barra se
  monta en `<body>` para escaparse.
- **Ancho.** Casi todos los themes centran el contenido en un contenedor
  (~1200px); ocupar el 100% se ve desalineado con el resto del sitio. El kit
  mide ese contenedor (`--kc-maxw` + clase `kc-w-container`) y alinea el
  configurador a él. Configurable en tres niveles:

  | Dónde | Cómo |
  |---|---|
  | Por producto | ProductLab → Ficha → Estilo → **Ancho en la tienda** (`auto` / `container` / `full`) — manda sobre lo global |
  | Global del theme | `window.KIMOS_WIDTH = 'auto' \| 'container' \| 'full'` en `custom.js` |
  | Contenedor a medida | `window.KIMOS_CONTAINER_SELECTOR = '.mi-container'` |

  En modo contenedor, las secciones de imagen marcadas **"Borde a borde"**
  siguen sangrando hasta los bordes de la ventana: ese es su propósito.

Prueba offline: `node test/run-encaje-theme.mjs` (requiere jsdom).

## Jumpseller renombra los assets (importante)

Al subir un archivo a **Assets**, Jumpseller **sanea el nombre y le quita los
guiones**: `kimos-configurador.js` queda servido como `kimosconfigurador.js`
(y además puede minificar: `custom.js` → `custom.min.js?<ts>`). Los tres
scripts del kit lo contemplan y prueban todas las variantes del nombre antes
de rendirse, así que **sube los archivos con su nombre original** y no hace
falta renombrar nada.

Síntoma cuando esto falla (kits anteriores a jul-2026):

```
[kimos3d] no se pudo cargar kimos-configurador.js desde https://assets.jumpseller.com/... 
```

Comprueba en Assets con qué nombre quedaron; si ves `kimosconfigurador.js`,
actualiza los tres scripts del kit a la versión actual.

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
`version: 2`. El kit (configurador **v5.12.0**) consume v1 y v2 por la misma
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
- Los ajustes son **silenciosos**: el cliente nunca ve carteles de
  "Ajustado automáticamente" ni valores de relleno ("No aplica") — la app
  los publica y el kit los gestiona por debajo.

### Caché del JSON público (60 s)

El kit guarda el JSON de la app en `localStorage` con TTL de 60 segundos: las
visitas siguientes pintan la ficha al instante sin esperar a KIMOS, y un cambio
publicado desde la app se ve en la tienda en un minuto como mucho. Si KIMOS no
responde, se usa la última copia buena aunque esté vencida: la ficha nunca se
cae por una caída del panel (el precio y el carro ya venían del theme, así que
la compra no depende de KIMOS en ningún caso).

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

> **Al actualizar el kit, `custom.js` es el archivo delicado.** Los otros dos
> se pisan sin miedo, pero este lleva TU configuración: si lo subes tal cual
> viene, `KIMOS_3D_URL` vuelve a la URL de ejemplo y la ficha KIMOS deja de
> aparecer sin ningún error a la vista (la tienda muestra su ficha normal).
> Lo normal al actualizar es **no** subir `custom.js`: basta con cambiar
> `KIMOS_ASSET_V` en el que ya tienes. El kit avisa por consola —
> `KIMOS_3D_URL sigue con la URL de ejemplo`— si se cuela.

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
