# ANFITRIÓN AIEP

Anfitrión para el **totem** del Seminario **«IA y Protección de Datos: Lo que
Todo Negocio Debe Saber para No Quedarse Atrás»**, en la Sede AIEP San Joaquín,
organizado con los Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e
Independencia.

**Versión actual: 1.2.0**

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
| 11:30–12:30 | «IA y Automatización: Menos Tiempo Operativo, Más Crecimiento» | Marco Mella |
| 12:30–13:00 | «Datos, IA y las Nuevas Reglas del Juego» | Nicolás Seguel |
| 13:00–13:15 | Cierre de la Jornada | — |

## De dónde sale cada dato

| Contenido | Fuente |
|---|---|
| Programa, horarios, sede y personas | Documento oficial «Programa Seminario IA» del organizador |
| Título, subtítulo, fecha e identidad visual | Afiche oficial del seminario |
| Logos AIEP y Centros de Negocios SERCOTEC | Extraídos del propio `.docx` del programa |
| Perfiles profesionales de los cuatro expositores | URLs entregadas por el organizador |
| Retratos y nombres completos de los expositores | Lámina oficial de fotos del organizador |
| Sección «Contexto» | Fuentes públicas — marcado en pantalla como material complementario |

**Nada está inventado.** El programa oficial no incluye biografías. De las cuatro
personas, solo **Jack Esquenazi** tiene material público verificable, así que es
la única con biografía —y su ficha declara la fuente en pantalla—. Las otras tres
**no la inventan**: dicen que el programa no la trae, muestran el cargo que sí
consta y remiten al QR de su perfil.

**Un nombre con tres grafías, resuelto.** El programa escribe «Marcos Mella»; la
lámina oficial de retratos, «MARCO MELLA»; su perfil profesional, «Marco Antonio
Mella González». Dos fuentes contra una, así que el nombre visible pasa a **Marco
Mella**. El del programa no se pierde: viaja en el snapshot del agente como
`nombreEnPrograma`. De la misma lámina sale «Patricia Carolina Sandoval» como
nombre completo.

### Dos inconsistencias del documento original

Ambas se resolvieron sin alterar la fuente y quedan visibles en el snapshot del
agente:

1. **Bloque 12:30–13:00.** El documento declara «50 minutos de exposición y 10
   minutos de preguntas», que no cabe en una franja de 30 minutos. Los otros dos
   bloques de charla sí cuadran (60 min). Se muestra la franja horaria —dato
   duro— y **se omite esa línea de duración solo en ese bloque**, en vez de
   exhibir una contradicción en una pantalla pública. Conviene aclararlo con el
   organizador.
2. **Cierre a las 13:15 vs. horario general hasta las 14:00.** No se inventa qué
   ocurre en esos 45 minutos: la app muestra ambos datos por separado y lo dice
   con todas sus letras al pie del programa.

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
2. **Programa** — los siete bloques, el actual resaltado en rojo y los pasados
   atenuados.
3. **Expositores** — las cuatro personas, con el bloque en que participan; al
   tocar una ficha se abre su reseña y el QR a su perfil profesional.
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

> **Pendientes en 1.2.0.** La infraestructura está completa y las cuatro ranuras
> de `FOTOS` (en `dist/index.js`) están puestas y **vacías**: hoy las cuatro
> fichas muestran iniciales. El archivo de la lámina no pudo llegar al entorno
> donde se construyó esta versión. Para completarlas basta rellenar esas cuatro
> cadenas con los `data:` URI de los recortes; no hay que tocar nada más.

Los retratos salen de la lámina 2×2 que entrega el organizador. Se recortan por
cuadrantes en orden de lectura —Jack ↖, Patricia ↗, Marco ↙, Nicolás ↘—, se
reescalan a 320 px y se embeben como `data:` URI en JPEG, igual que los logos:
el totem no pide nada a la red.

Cada ficha usa el componente `Avatar`, que cae a las iniciales de la persona si
la foto falta o no carga, así que la app nunca queda con un hueco. El recorte es
circular con `object-position: 50% 22%` para no cortar la frente. Se pueden
apagar todas desde ⚙️ Configurar → *Mostrar las fotos de los expositores*.

El snapshot del agente expone `foto: true|false` por persona, de modo que se
puede auditar cuántas hay embebidas sin abrir el bundle.

## QR

Siete códigos precalculados en build (paquete `qrcode`, nivel M) y embebidos como
matriz de bits en base64: mapa de la sede, `sercotec.cl`, `aiep.cl` y el perfil
profesional de cada uno de los cuatro expositores. El totem no carga un generador
ni depende de la red. Se rinden como un único `<path>` SVG por código.

Los cuatro QR de perfil se verificaron **decodificándolos con `jsQR`** a la
resolución a la que se pintan: los cuatro devuelven su URL exacta.

> El organizador no entregó una URL de landing del seminario. Si aparece, se
> añade un octavo QR en un minuto.

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
| 1.2.0 | Nombres reconciliados con la lámina oficial de retratos: «Marco Mella» (el programa decía «Marcos») y «Patricia Carolina Sandoval», conservando el nombre del programa en el snapshot. Infraestructura de fotos: componente `Avatar` con caída a iniciales, recorte circular, interruptor `mostrarFotos` y `foto` en el snapshot. |
| 1.1.0 | Perfiles profesionales de los cuatro expositores: QR por persona en la ficha desplegable (verificados con `jsQR`), biografía de Jack Esquenazi con su fuente, y nombre completo de Marco Antonio Mella González junto al «Marcos Mella» del programa. |
| 1.0.0 | Primera versión: seis secciones, programa de siete bloques con bloque en vivo, cuatro expositores, contexto complementario, consulta guiada, tablón de preguntas y encuesta colectivos, tres QR embebidos, logos oficiales extraídos del `.docx` y reinicio por inactividad. |
