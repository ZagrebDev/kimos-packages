# Traductor de Banners

Localiza los banners de una ficha de producto **sin tocar el producto**.

Las imágenes de una página de producto son banners verticales de hasta
1200 × 12000 px. Ningún modelo de imagen devuelve algo así, y pedirle que
«redibuje la imagen en español» degrada los renders — que es justo lo que la
marca no puede permitirse.

Por eso esta app **no regenera la imagen: la edita**.

---

## Cómo funciona

Por cada bloque de texto:

1. **El modelo de visión lee el panel** y devuelve, por cada bloque, su caja
   aproximada, el texto original y su traducción.
2. **El motor de píxeles mide el bloque sobre la imagen real**: recorta la
   caja al glifo exacto, cuenta las líneas, y extrae el color, el degradado, la
   alineación y el interlineado *de los píxeles originales* — no de lo que
   estime el modelo, que en eso se equivoca bastante.
3. **Se borra sólo ese rectángulo**, reconstruyendo el fondo (plano, degradado
   o foto) a partir de sus bordes.
4. **Se redibuja el español** al tamaño que reproduce el alto del texto
   original, reajustando si no cabe (suele ser ~20 % más largo).

Consecuencia importante: **todo lo que está fuera de las cajas de texto queda
idéntico al original, píxel a píxel**. Los renders no se tocan, no se
recomprimen y no se reescalan. Los paneles son sólo la unidad de trabajo y de
revisión: el render final se hace sobre la imagen completa, así que no hay
costuras.

### Dónde corre cada cosa

| | Dónde | Por qué |
|---|---|---|
| Visión y edición generativa | `shell.ai` → Vertex AI del tenant | La credencial no sale del backend (APP-SPEC §7.h) |
| Medición, borrado y redibujado | `<canvas>`, en el navegador | Local, gratis e instantáneo: evita mandar 12000 px de ida y vuelta por cada ajuste de tipografía |
| Imágenes y exportaciones | `shell.files` | Ruta gestionada por el host, aislada por app |
| Estado del documento | `shell.saveData` | Cada documento es un producto |

---

## El flujo, paso a paso

| Paso | Acción | Costo |
|---|---|---|
| 1 | Subir los banners (columna izquierda, botón **+**) | gratis |
| 2 | **Analizar panel** — detecta y traduce los textos | 1 llamada |
| 3 | Revisar el resultado y corregir en la columna derecha | gratis |
| 4 | *(opcional)* **✨ Generar panel con IA** si el panel es mayormente fotográfico | 1 llamada |
| 5 | **Aprobar panel ✓** — salta al siguiente | gratis |
| 6 | Repetir 2–5 hasta terminar | |
| 7 | **⤓ Exportar imagen final** | gratis |

La imagen sale en la carpeta `traducidas/` del almacenamiento de la app. Todo
el estado se guarda a medida que trabajas: puedes cerrar la ventana y retomar
donde ibas.

### Atajos

`a` analizar · `Enter` aprobar · `↓`/`j` panel siguiente · `↑`/`k` anterior ·
`b` mostrar/ocultar las cajas detectadas

---

## Los controles de cada bloque

- **Casilla de la cabecera** — desactívala para dejar ese texto **en el idioma
  original** (ya viene desactivada en logos, marcas y siglas).
- **Campo de texto** — edita la traducción a mano. El preview se rehace solo,
  sin costo.
- **Acortar** — pide al modelo una versión más corta, con tope de caracteres.
  Útil cuando el español no entra en el espacio del original.
- **Reescribir** — una indicación libre («más formal», «que quepa en una
  línea», «usa portátil en vez de handheld»).
- **tam / alin / peso / color** — ajuste tipográfico fino. El color viene
  medido de la imagen; puedes forzarlo si el muestreo no acertó.
- **fondo** — cómo se borra el texto original: `plano`, `degradado`, `foto`.
  Si queda un fantasma del original, prueba cambiar esto.
- **mover x / mover y / ancho +** — desplaza el texto o dale más espacio.
- **✨ Redibujar** — manda ese recorte al modelo de imagen.
- **Remedir** — vuelve a medir color y caja sobre los píxeles. Gratis.
- **✕** — descarta el bloque; el original queda intacto.

El botón **+** de la cabecera agrega a mano un bloque que el modelo no detectó.

Cada texto reescrito guarda sus versiones anteriores: recuperarlas no cuesta
ninguna llamada. Regenerar es una apuesta — unas veces sale mejor y otras
peor — y perder un resultado bueno por probar sería caro.

---

## Consistencia entre imágenes: el glosario

El botón **Glosario** define:

- **No traducir**: nombres de marca y modelo, siglas técnicas, unidades.
- **Equivalencias fijas**: `handheld = consola portátil`,
  `battery life = autonomía`, `thermal system = sistema de refrigeración`…

Se aplica en **cada** análisis y en cada reescritura, y es lo que hace que
quince banners usen los mismos términos. Si a mitad de camino cambias un
término, edítalo ahí y vuelve a analizar los paneles afectados.

Como cada documento es un producto, cada producto tiene su propio glosario:
la app no está atada a ningún proveedor.

---

## Overlay o IA: qué cuesta cada uno

El botón **✨ Generar panel con IA** manda el panel entero al modelo en una
sola llamada, usando las traducciones ya revisadas como referencia.

**Sale mucho más barato que ir bloque por bloque**, porque el costo lo domina
la imagen de salida, que es prácticamente el mismo se regenere un recorte
chico o el panel entero. Si ibas a redibujar 3 o más bloques de un panel,
conviene generarlo completo.

**Pero el precio no se paga en créditos, se paga en fidelidad.** El modelo
resintetiza *toda* la imagen, incluidos los renders del producto. Con overlay
el producto queda intacto bit a bit; con IA se redibuja: a tamaño de pantalla
se nota poco y el texto sale muy limpio, pero el detalle fino ya no es la foto
original. Además el modelo suele **reflowear** el texto (un párrafo de 3
líneas puede volver con 4).

Por eso la app **no reemplaza nada**: guarda la versión IA aparte y aparece un
selector bajo la barra para alternar **overlay / IA** y comparar. Lo que esté
seleccionado al exportar es lo que se escribe en el archivo final.

Cuándo conviene cada uno:

- **Overlay** — paneles con texto sobre fondo plano o degradado, que es la
  mayoría. Fidelidad total del producto.
- **IA** — paneles donde casi todo el texto va incrustado sobre fotografía, o
  cuando el overlay deja fantasmas difíciles de limpiar.

---

## Sobre el texto incrustado en fotos

Cuando un texto va encima de una foto, la medición automática no es fiable y
el bloque aparece con un aviso ⚠. Sobre una foto la tinta no se distingue del
fondo: la máscara se llena y el borrado terminaría promediando la foto entera.
Cuando la app detecta eso no intenta adivinar — vuelve a la caja del modelo y
marca el bloque. Ahí tienes tres caminos:

1. **Overlay con fondo `foto`** (lo que hace por defecto). Texto nítido, y el
   borrado se nota poco si el fondo es oscuro o poco texturado.
2. **✨ Redibujar con IA**. Respeta el fondo fotográfico y devuelve texto
   legible. Suele colar alguna palabra de más o alguna sílaba repetida, así
   que **léelo siempre antes de aprobar**.
3. **Dejarlo en el idioma original** (desactivar la casilla). Razonable para
   letra legal.

---

## Lo que cuesta, a la vista

La cabecera muestra las llamadas y los tokens consumidos en el documento. Cada
análisis y cada redibujado gastan **cuota de Vertex del proyecto de la
empresa**: es dinero real de quien instaló la app. Por eso el permiso
`ai.image` se aprueba explícitamente al instalar, nada se regenera en bucle
automático, y el gasto se enseña en vez de esconderse.

---

## El agente

La app expone sus acciones al agente de KIMOS (`agent.control`), que opera las
mismas funciones que la interfaz — así la pantalla se repinta sola cuando el
agente actúa:

| Herramienta | Qué hace | Costo |
|---|---|---|
| `LISTAR_IMAGENES` | Las imágenes y en qué va cada una | gratis |
| `SELECCIONAR_IMAGEN` | Abre una por nombre o id | gratis |
| `ANALIZAR_PANEL` | Detecta y traduce un panel | 1 llamada |
| `LEER_BLOQUES` | Los textos del panel, con su traducción | gratis |
| `EDITAR_BLOQUE` | Cambia una traducción, o la activa/desactiva | gratis |
| `APROBAR_PANEL` | Da por bueno el panel y pasa al siguiente | gratis |
| `EDITAR_GLOSARIO` | Añade términos fijos y palabras que no se traducen | gratis |
| `EXPORTAR_IMAGEN` | Compone y guarda la imagen final | gratis |

Las instrucciones del agente dicen explícitamente cuáles cuestan dinero, para
que no las repita por su cuenta.

Ejemplos de lo que se le puede pedir:

> «Analiza los tres primeros paneles de 07_85wh_battery y dime qué encontró.»
>
> «En el glosario, que "handheld" sea siempre "consola portátil" y que
> ONEXPLAYER y AMOLED no se traduzcan.»
>
> «El titular del panel 2 quedó muy largo, acórtalo a una línea.»

---

## Requisitos

- El permiso **`ai.image`** concedido al instalar. Los permisos se guardan al
  **instalar**: si la app se instaló antes de que ese KIMOS conociera el
  permiso, se descartó y hay que actualizarla desde la Tienda.
- **`files.write`** para guardar originales y exportaciones.

Formatos de entrada: `.jpg`, `.png`, `.webp`.

---

## Traer y llevar el trabajo

**⇩ Estado** descarga el documento como JSON; **⇧ Estado** lo trae de vuelta
sobre las imágenes ya subidas, emparejándolas **por nombre de archivo**.

No es un respaldo por si acaso: el análisis está **pagado**. Un documento de
quince banners lleva decenas de llamadas al modelo detrás, y perderlas porque
el trabajo sólo vivía dentro de una instancia es caro de verdad. También es
cómo se audita una traducción meses después — el JSON dice qué decisión
produjo cada texto.

Al importar, los **cortes de panel vienen del JSON y no se recalculan**: si se
recalcularan, un bloque analizado en el panel 1 podría caer en el 2 y el
trabajo importado quedaría descuadrado. Lo que no viaja son los paneles
regenerados con IA (su URL apuntaba a otra instalación) y lo medido sobre los
píxeles, que la app vuelve a medir gratis al abrir.

Súbete las imágenes **antes** de importar: una que no esté subida se reporta
como huérfana en vez de restaurarse en silencio.

---

## Probar el motor

El motor de píxeles se prueba en un navegador de verdad, porque lo que se
prueba es `getImageData` y no hay forma honesta de verificar un motor de
canvas sin un canvas:

```bash
npm i -D playwright && npx playwright install chromium
BANNERS_IMG=/ruta/a/banners node apps/banners-translator/test/motor.mjs
```

Y la importación, que es lo que evita volver a pagar el análisis:

```bash
ESTADO_JSON=/ruta/a/estado.json node apps/banners-translator/test/importar.mjs
```

La primera comprueba lo que decide si el resultado sirve: que los cortes de panel caigan
en franjas limpias, que la medición crezca la caja corta del modelo hasta el
texto real y le saque el color, y que el borrado **no toque un solo píxel
fuera de la caja**. Las pruebas de medición y borrado corren sobre lienzos
sintéticos, donde la respuesta correcta se conoce; el banner real sólo se usa
para el corte en paneles.

---

## Origen

Portada desde una herramienta local (`onexplayer-traductor`) que hacía el
mismo trabajo con un backend Python + PIL/numpy. Al entrar en KIMOS, todo el
trabajo de píxeles se movió al `<canvas>` del navegador —una app instalable no
tiene backend propio— y las llamadas al modelo pasaron por `shell.ai`. El
algoritmo de medición es el mismo, incluidas sus guardas: la de desborde sobre
fondos fotográficos, el crecimiento de la caja por contigüidad de tinta y el
reajuste vertical que evita que se quede colgando la cola de una «y».
