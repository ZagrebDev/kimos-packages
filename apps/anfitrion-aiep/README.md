# ANFITRIÓN AIEP

Anfitrión para el **totem** del Seminario **«IA y Protección de Datos: Lo que
Todo Negocio Debe Saber para No Quedarse Atrás»**, en la Sede AIEP San Joaquín,
organizado con los Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e
Independencia.

**Versión actual: 1.5.0**

---

## El seminario

| | |
|---|---|
| Cuándo | Jueves 3 de septiembre de 2026, 09:30 a 14:00 hrs |
| Dónde | Sede AIEP San Joaquín — Av. Vicuña Mackenna 4685, San Joaquín, Región Metropolitana |
| Cómo llegar | Metro San Joaquín, Línea 5 |
| Sede anfitriona | AIEP, de la Universidad Andrés Bello |
| Organizan | Centros de Negocios SERCOTEC · Ñuñoa, San Pablo e Independencia |

### Programa

| Hora | Bloque | Quién |
|---|---|---|
| 09:30–10:15 | Acreditación y Café de Bienvenida (Salón Primer Piso) | — |
| 10:15–10:20 | Palabras de Bienvenida | Patricia Sandoval, Directora Sede San Joaquín, AIEP |
| 10:20–10:30 | Saludo Institucional | Jack Esquenazi, Director Regional Metropolitano, SERCOTEC |
| 10:30–11:30 | «Protege tu Negocio en la Era de la IA» | Nicolás Seguel |
| 11:30–11:35 | Pausa — baño, agua y networking | — |
| 11:35–12:35 | «IA y Automatización: Menos Tiempo Operativo, Más Crecimiento» | Marco Mella |
| 12:35–12:40 | Presentación de Figit.ai | Bryan Valdés Chacana y José Ignacio Canales, fundadores |
| 12:40–13:40 | «Datos, IA y las Nuevas Reglas del Juego» | Nicolás Seguel |
| 13:40–13:55 | Cierre de la Jornada | — |

## De dónde sale cada dato

| Contenido | Fuente |
|---|---|
| Programa, horarios, sede y personas | Documento oficial «Programa Seminario IA» del organizador |
| Título, subtítulo, fecha e identidad visual | Afiche oficial del seminario |
| Logos AIEP y Centros de Negocios SERCOTEC | Extraídos del propio `.docx` del programa |
| Perfiles profesionales de los cuatro expositores | URLs entregadas por el organizador |
| Retratos y nombres completos de los expositores | Lámina oficial de fotos del organizador |
| Sección «Contexto» | Fuentes públicas — marcado en pantalla como material complementario |

**Nada está inventado.** Las cuatro personas tienen reseña, y **cada una declara
su fuente en pantalla**. Ninguna se escribió a ojo: salen de material público
verificable, cotejado uno por uno. La ficha de Figit.ai se limita a lo que dice
el programa del seminario.

**El nombre de Mella, resuelto.** El programa escribe «Marcos Mella»; la lámina
oficial de retratos y su perfil profesional coinciden en **Marco Mella**, que es
la grafía que se muestra. El nombre del programa no se pierde: viaja en el
snapshot del agente como `nombreEnPrograma`.

En 1.2.0 se le había atribuido el nombre largo «Marco Antonio Mella González»,
tomado de un perfil que resultó ser **de otro Marco Mella**. Se retiró al llegar
el perfil correcto. De la lámina sí sale «Patricia Carolina Sandoval» como
nombre completo.

### Dos QR que apuntaban a la persona equivocada

Al llegar los perfiles definitivos se descubrió que dos de los QR de 1.1.0
llevaban a **homónimos**, no a los expositores del seminario:

- **Nicolás Seguel** — el QR apuntaba a `nicolas-seguel` (Head of Growth &
  Automation en Wbuild). El correcto es `nicolas-seguel-1581a926`, fundador de
  TUCADIS.
- **Marco Mella** — el QR apuntaba a `marco-antonio-mella-gonz…-212331274`. El
  correcto es `mellamarco`, director de SiteUp Chile.

Ambos corregidos y re-verificados con `jsQR`. Es la clase de error que un totem
público propaga en silencio: quien escanea acaba en el perfil de otra persona.

### El cronograma nuevo resolvió una inconsistencia

La versión anterior del programa declaraba «50+10 minutos» en una franja de 30
(12:30–13:00). El cronograma actualizado mueve ese bloque a **12:40–13:40**, con
lo que las tres charlas duran 60 minutos y la contradicción desaparece en
origen: ya no hace falta omitir nada.

Queda un detalle menor, dicho al pie del programa: los bloques llegan hasta las
**13:55** y el horario general hasta las **14:00**.

## El totem manda el diseño

| Decisión | Por qué |
|---|---|
| **Dos modos** (`.modo-totem` / `.modo-escritorio`) | Se deciden midiendo la **raíz** con `ResizeObserver`, no con media queries: dentro del shell la app vive en una ventana y el viewport no dice nada útil. Se fuerza desde ⚙️ Configurar. |
| **Tipografía y botones XL** | En totem la escala salta (base 21 px, título 66 px) y todo objetivo táctil mide **≥76 px**. |
| **Vuelve sola al inicio** | A los 90 s sin tocar (configurable, 15–600) regresa a *Ahora* y borra la consulta a medio responder. |
| **Sin estado personal** | Un totem es **compartido**. Lo que se guarda es colectivo: preguntas y encuesta. |
| **QR en vez de enlaces** | Nadie escribe una URL en un totem. |

### Las seis secciones

1. **Ahora** — cuenta regresiva; durante el seminario, el bloque en curso con
   barra de avance y el siguiente. Fecha, horario, sede y QR del mapa.
2. **Programa** — los nueve bloques, el actual resaltado en rojo y los pasados
   atenuados.
3. **Expositores** — las cuatro personas más Figit.ai, con el bloque en que
   participan. Cada ficha lleva un botón **«Ver reseña»** bajo el horario que
   despliega la biografía, su fuente y el QR al perfil.
4. **Contexto** — Ley 21.719 y qué es un Centro de Negocios SERCOTEC. Se puede
   ocultar entera desde ⚙️ Configurar.
5. **Consulta** — dos preguntas y una recomendación de qué bloques ver, con
   quién conversar y qué revisar; más el tablón de preguntas y la encuesta.
6. **Organizan** — AIEP y los tres Centros SERCOTEC con sus logos y QR.

## Identidad visual

Alineada con el afiche del seminario: banda azul del rótulo **SEMINARIO**,
título blanco en versalitas, subtítulo sobre banda roja, fecha «03 Septiembre»
en grande, pastilla de horario y pin de ubicación.

| Token | Valor | Origen |
|---|---|---|
| `--ai-azul` / `--ai-hondo` | `#0B63D6` / `#052A66` | Degradado azul del afiche |
| `--ai-band` | `#1636C4` | Banda del rótulo «SEMINARIO» |
| `--ai-rojo` | `#E4303C` | **Muestreado** del logo SERCOTEC |
| `--ai-sercotec` | `#2460A8` | **Muestreado** del logo SERCOTEC |
| `--ai-rojo-2` / `--ai-navy` | `#B40000` / `#002448` | **Muestreados** del logo AIEP |

Los cuatro últimos salen de un muestreo pixel a pixel de los logos oficiales,
no de estimarlos a ojo.

Como en la v2 del anfitrión de NextTime, esto es una **desviación deliberada de
APP-SPEC §9**: la app cablea colores porque es una app de marca y un totem no
tiene modo día/noche que seguir. Del tema del host se toman `--shadow-sm` /
`--shadow-md`.

### Logos

Los PNG oficiales venían **dentro del `.docx` del programa** y van embebidos
como `data:` URI en el bundle, así que son los archivos reales y cargan sin red.
Son opacos sobre blanco, por eso se presentan sobre tarjetas blancas, igual que
la franja inferior del afiche.

## Fotos

Los cuatro retratos oficiales llegaron **dentro de un `.docx`** del organizador,
ya separados uno por uno. Se recortan a cuadrado anclando arriba —en un retrato
de carnet la cabeza vive en la mitad superior, así que centrar el cuadrado
cortaría la frente—, se reescalan a 320 px y se embeben como `data:` URI en
JPEG, igual que los logos: **71 KB los cuatro**, y el totem no pide nada a la
red.

Cada foto se cotejó una por una contra la lámina rotulada que envió el
organizador antes de asignarla, para no cruzar caras y nombres.

**Figit.ai va como empresa**, no como persona: en su ficha el círculo se sustituye
por el **logotipo oficial** —también extraído de un `.docx` del organizador— sobre
un cuadrado blanco redondeado, porque un logotipo con texto no sobrevive a un
recorte circular.

Cada ficha usa el componente `Avatar`, que cae a las iniciales de la persona si
la foto falta o no carga, así que la app nunca queda con un hueco. El recorte es
circular, y en modo totem el avatar crece a 6,4 em (≈134 px) para que la cara se
lea de pie y a un par de pasos. Se pueden apagar todas desde ⚙️ Configurar →
*Mostrar las fotos de los expositores*.

El snapshot del agente expone `foto: true|false` por persona, de modo que se
puede auditar cuántas hay embebidas sin abrir el bundle.

### Estilos críticos dentro del bundle

`dist/index.css` no cambia de nombre entre versiones, así que un caché de
assets puede servir el JS nuevo con la hoja de estilos vieja. Pasó en el totem:
las fichas salieron con la foto cuadrada a tamaño natural y el botón sin fondo,
mientras la cabecera anunciaba la versión nueva.

Por eso las reglas que gobiernan **que el texto quepa en su recuadro** —tamaño
y forma del avatar, apilado en columna, ancho del texto y chrome del botón—
viajan en la constante `CSS_CRITICO` del bundle y se inyectan al montar, con la
clase raíz repetida para ganar en especificidad sea cual sea el orden de carga.

Está verificado cargando a propósito el CSS de la 1.1.0 junto a este bundle: la
maqueta sale correcta igual.

## QR

Ocho códigos precalculados en build (paquete `qrcode`, nivel M) y embebidos como
matriz de bits en base64: mapa de la sede, `sercotec.cl`, `aiep.cl`, `figit.ai` y
el perfil profesional de cada uno de los cuatro expositores. El totem no carga un generador
ni depende de la red. Se rinden como un único `<path>` SVG por código.

Los QR de perfil se verificaron **decodificándolos con `jsQR`** a la resolución a
la que se pintan: todos devuelven su URL exacta.

> El organizador no entregó una URL de landing del seminario. Si aparece, se
> añade un noveno QR en un minuto.

## Persistencia

`multiInstance: true`. Lo compartido —preguntas y votos— se guarda con
`saveData` (debounce 600 ms). Lo transitorio (sección visible, ficha abierta,
consulta a medias) **no se guarda**. Todo lo que entra pasa por `normalizar()`.

```jsonc
{
  "votos": { "proteger": 9, "automatizar": 14 },
  "preguntas": [{ "id": "q…", "texto": "…", "para": "marcos-mella", "ts": 1756… }]
}
```

## Preferencias (⚙️ Configurar)

| Campo | Por defecto | Efecto |
|---|---|---|
| `modo` | `auto` | Fuerza totem o escritorio. |
| `segundosInactividad` | `90` | Espera antes de volver al inicio (15–600). |
| `mostrarContexto` | `true` | Oculta la sección Contexto entera. |

## Agente IA (`agent.control`)

`getSnapshot()` devuelve el evento, la fase, el bloque en curso y el siguiente,
los siete bloques, las cuatro personas, el contexto y el estado del público —
más dos `avisos` explícitos: que Contexto no es parte del programa oficial, y la
inconsistencia del bloque 12:30.

| Tool | Payload |
|---|---|
| `IR_A_SECCION` | `{ seccion }` |
| `ADD_PREGUNTA` | `{ texto, personaId? }` |
| `REMOVE_PREGUNTA` | `{ id }` |
| `VOTAR_TEMA` | `{ temaId }` |
| `RECOMENDAR` | `{ perfil?, foco }` — solo lectura |
| `VOLVER_AL_INICIO` | `{}` |

## Verificación

```bash
node tools/check-versions.mjs anfitrion-aiep
node tools/pack.mjs apps/anfitrion-aiep
```

- Smoke test: las seis secciones renderizan, el programa oficial aparece
  completo, la duración contradictoria sale **solo dos veces** (no en el bloque
  de 30 min), los logos van embebidos como `data:` URI, los QR se pintan, el
  agente rechaza entradas inválidas, el totem vuelve solo al inicio sin llevarse
  los datos compartidos y un documento corrupto no rompe la vista.
- Auditoría en Chromium a **1080×1920** y **1180×860**: sin errores de consola,
  sin desbordes, sin logos rotos, modo totem correcto y tap mínimo de 76 px.

## Historial

| Versión | Cambios |
|---------|---------|
| 1.5.0 | **Chrome de vitrina unificado.** La barra de secciones sube y queda **bajo el header**; el pie de la pantalla lo ocupan ahora un **footer con el crédito del organizador y el logotipo de Kimos** (el mismo del resto de los totem del sistema) y una **franja reservada** (`--ai-dock-safe`, 340 px en totem) para que el widget de chat de la vitrina no tape el final del contenido. **Agente consultivo que se ve:** tres acciones nuevas —`MOSTRAR_PERSONA`, `MOSTRAR_BLOQUE`, `MOSTRAR_CONTEXTO`— llevan el totem a la ficha exacta de la que el agente está hablando, la abren y la resaltan unos segundos; `RECOMENDAR` deja la consulta guiada resuelta en pantalla en vez de limitarse a devolver texto. Contenido, paleta, tipografía e imágenes, sin cambios. |
| 1.4.2 | Los estilos que gobiernan la maqueta de las fichas viajan **dentro del bundle JS** e inyectados al montar. El totem sirvió una vez el JS nuevo con el `.css` viejo en caché —no cambia de nombre entre versiones— y las fichas salieron con la foto cuadrada a tamaño natural y el botón sin fondo. Verificado cargando a propósito el CSS de la 1.1.0 con este bundle: la maqueta sale correcta igual. Avatares a 112 px en totem. |
| 1.4.1 | Las fichas de expositor apilan el avatar sobre el texto en ambos modos. Con la foto al lado, en una tarjeta de rejilla se llevaba un tercio del ancho y el cargo se partía en dos o cuatro líneas según la resolución; ahora el texto dispone del ancho completo del recuadro en cualquier orientación. Avatares en px en vez de em, para que no se compongan con la escala del modo. |
| 1.4.0 | Cronograma actualizado a nueve bloques (pausa de 11:30 y presentación de Figit.ai de 12:35). Figit.ai como ficha de empresa con su logotipo oficial. Reseña para las cuatro personas, cada una con su fuente, desplegable con un botón **«Ver reseña»** bajo el horario. Corregidos dos QR que apuntaban a homónimos. |
| 1.3.0 | Los cuatro retratos oficiales, recortados a cuadrado y embebidos como `data:` URI (71 KB en total), cotejados uno por uno contra la lámina rotulada. Avatar más grande en modo totem para que la cara se lea a distancia. |
| 1.2.0 | Nombres reconciliados con la lámina oficial de retratos: «Marco Mella» (el programa decía «Marcos») y «Patricia Carolina Sandoval», conservando el nombre del programa en el snapshot. Infraestructura de fotos: componente `Avatar` con caída a iniciales, recorte circular, interruptor `mostrarFotos` y `foto` en el snapshot. |
| 1.1.0 | Perfiles profesionales de los cuatro expositores: QR por persona en la ficha desplegable (verificados con `jsQR`), biografía de Jack Esquenazi con su fuente, y nombre completo de Marco Antonio Mella González junto al «Marcos Mella» del programa. |
| 1.0.0 | Primera versión: seis secciones, programa de siete bloques con bloque en vivo, cuatro expositores, contexto complementario, consulta guiada, tablón de preguntas y encuesta colectivos, tres QR embebidos, logos oficiales extraídos del `.docx` y reinicio por inactividad. |
