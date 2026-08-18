# Anfitrión · Desayuno Ejecutivo de Ciberseguridad 2026

Anfitrión interactivo optimizado para **Totem Touch** y para el **modo vitrina vertical (9:16)** de Kimos Enterprise, del Desayuno Ejecutivo de Ciberseguridad 2026 de NextTime Software. 

**Versión actual: 2.5.0**

---

## Características de Diseño Touch

| Decisión | Por qué |
|---|---|
| **Navegación Superior Táctil XL** | Botones situados arriba (debajo del header) para evitar cualquier superposición con el widget de chat/asistente de IA situado en la parte inferior de la pantalla. |
| **Iconos 100% Blancos (Monocolor)** | Iconos vectoriales SVG nítidos y elegantes que garantizan alto contraste y legibilidad inmediata sobre fondos violeta/índigo. |
| **Agenda y Expositores Integrados** | Vista unificada donde cada bloque del programa incorpora las fotografías de los expositores, biografía completa, roles, empresas y código QR directo a su perfil. |
| **Paleta Idéntica al Landing** | Fondo con el degradado de las secciones del landing (`#4600F8` → `#7600CF`), tarjetas en el secundario `#040932`, acento cian `#00E4D0`, tipografía **Poppins** y texto blanco. |
| **Navegación que Cabe en 9:16** | En vertical los cuatro accesos pasan a una rejilla de cuatro columnas con el icono sobre el rótulo y el texto en dos líneas: ya no se recortan «Agenda y Expositores» ni «Consulta e Interacción», y desaparece el desplazamiento lateral. |
| **Pie Corporativo** | Réplica de la banda de cierre del landing (fondo cian `#00E4D0`) con tipografía **blanca**, el copyright de NextTime Software y el crédito **Powered by Kimos.dev** con el logotipo de Kimos vectorizado. |
| **Diagnóstico Autoaplicado** | La cuarta sección es el *Diagnóstico Rápido de Cumplimiento*: 10 preguntas de 10 puntos, una por pantalla, con puntaje sobre 100, nivel de madurez, brechas detectadas y la normativa a priorizar. |
| **Zona Libre para el Dock de Voz** | En vertical el cuerpo reserva 280 px al pie para que el micrófono flotante de la vitrina no tape el final del contenido. |
| **Header Ampliado con Logo Oficial** | Identidad corporativa de NextTime Software reforzada en la cabecera junto al reloj digital y badge en vivo. |
| **Retorno Automático al Inicio** | A los 90 s de inactividad (configurable) el totem regresa a la pantalla *Ahora* para el siguiente asistente. |

---

## Estructura de Secciones

1. **Ahora** — Cuenta regresiva antes del evento; durante la jornada muestra la sesión en curso con barra de progreso y la siguiente ponencia.
2. **Agenda y Expositores** — Cronograma de 08:30 a 11:30 con las 6 ponencias, etiquetas de leyes aplicables y las fichas completas de los expositores (fotos, biografías verificadas y QR individual).
3. **Marco Legal** — Resumen estructurado y puntos clave de cumplimiento de la **Ley 21.663** (Ley Marco de Ciberseguridad) y la **Ley 21.719** (Protección de Datos Personales).
4. **Diagnóstico de Cumplimiento** — *Diagnóstico Rápido de Cumplimiento en Ciberseguridad y Protección de Datos*: 10 preguntas de 10 puntos (100 en total), una por pantalla con avance automático al tocar. Al terminar entrega el puntaje, el nivel de madurez, el listado de brechas con la ley que las exige y la normativa a priorizar.

---

## Cambios de la versión 2.2.0

- **Estilo alineado al landing oficial.** El fondo pasa del degradado radial
  oscuro al degradado violeta→magenta de las secciones del landing
  (`linear-gradient(#4600F8 → #7600CF)`); las tarjetas usan el color secundario
  `#040932` con la misma sombra (`0 0 10px rgba(0,0,0,.5)`), el texto es blanco
  y el acento sigue siendo `#00E4D0`. Tipografía Poppins en toda la app.
- **Navegación superior legible en vertical.** En modo totem/vitrina los botones
  se disponen en rejilla con el icono arriba y el rótulo debajo (dos líneas si
  hace falta). Bajo 720 px de ancho la rejilla pasa a 2×2.
- **Pie nuevo.** Banda cian del landing con tipografía blanca:
  `© 2026 NextTime Software` · `Powered by KIMOS.dev`, con el logotipo de Kimos
  incrustado como SVG (trazado desde `kimos-enterprice/frontend/public/logos/KIMOS.png`,
  sin dependencias externas ni peticiones de red).
- **Espacio para el dock de voz.** En vertical el cuerpo reserva 280 px
  inferiores, la altura que ocupa el micrófono flotante de la vitrina.

> Nota de contraste: el pie usa tipografía blanca sobre el cian `#00E4D0` por
> pedido expreso. Es una combinación de bajo contraste, así que se compensa con
> peso 600 y una sombra sutil (`0 1px 2px rgba(4,9,50,.45)`). Si en el totem se
> ve poco legible, basta cambiar `.ec-ft { color }` a `#040932`.

---

## Cambios de la versión 2.3.0

La pestaña *Consulta e Interacción* se reemplaza por completo con el
**Diagnóstico Rápido de Cumplimiento en Ciberseguridad y Protección de Datos**
(pasa a llamarse *Diagnóstico de Cumplimiento* en la navegación). Se retiran el
diagnóstico consultivo por rol, el tablón de preguntas al panel y la encuesta de
temas de la sala, junto con sus herramientas de agente.

### El formulario

Las 10 preguntas y el orden de sus alternativas se conservan tal cual llegan del
formulario oficial. Se recorren **una por pantalla**: al tocar una alternativa se
registra y avanza sola, con botones *Anterior* / *Siguiente* y diez puntos de
posición para volver a cualquier pregunta y corregir.

### Pauta de puntaje

Cada pregunta vale 10 puntos, 100 en total. El formulario original no traía el
valor de cada alternativa, así que se aplicó esta pauta:

| Alternativa | Puntos |
|---|:--:|
| Control implementado y vigente | 10 |
| Control implementado a medias (desactualizado, parcial, sin plan o solo algunos) | 5 |
| Control ausente o «No aplica» | 0 |

Las alternativas de 5 puntos son las de las preguntas 1, 6, 7, 8 y 10; el resto
solo admite 10 o 0.

### Resultado

| Puntaje | Nivel |
|---|---|
| 0 – 40 | Riesgo crítico |
| 41 – 70 | Cumplimiento en desarrollo |
| 71 – 90 | Cumplimiento avanzado |
| 91 – 100 | Cumplimiento consolidado |

Además del puntaje se listan las **brechas** (todo control bajo los 10 puntos)
con la ley que lo exige, y la **normativa a priorizar**, ordenada por cuántas
brechas apunta a cada una. Cada pregunta está mapeada a la Ley 21.663, a la
21.719 o a ambas, lo que enlaza el resultado con la sección *Marco Legal*.

### Datos

Las respuestas son **efímeras**: viven en el estado de la vista y se borran al
volver al inicio por inactividad, así el siguiente asistente parte con el
formulario limpio. Lo único que persiste es un **agregado anónimo** de la sala
—cuántos diagnósticos se completaron en el totem, la suma de puntajes para el
promedio y cuántas veces se eligió cada alternativa— que se muestra en la
portada del diagnóstico. Nunca se guardan respuestas individuales ni datos de
contacto, en línea con el aviso del formulario.

### Herramientas de agente

Se retiran `ADD_PREGUNTA`, `REMOVE_PREGUNTA`, `VOTAR_TEMA` y `RECOMENDAR`. Las
reemplazan `INICIAR_DIAGNOSTICO`, `RESPONDER_DIAGNOSTICO`, `IR_A_PREGUNTA`,
`REINICIAR_DIAGNOSTICO` y `RESULTADO_DIAGNOSTICO`, de modo que el asistente de
voz de la vitrina puede conducir el formulario completo y leer el resultado con
sus brechas.

---

## Cambios de la versión 2.4.0

Rediseño de las tres primeras secciones en torno a un modal de detalle y al
tiempo real, más ajustes de marca.

**Ahora.** Se quitan la cuenta regresiva del contenedor principal y los dos
botones inferiores («Ver Agenda…» y «Revisar Marco Legal»). En su lugar, dos
tarjetas visuales que se actualizan solas cada segundo según la hora: la
**sesión en curso** y la **siguiente**, cada una con las fotos de sus
expositores (o el isotipo de NextTime en las sesiones de la organización) y,
en la sesión en curso, una barra de avance. Antes del evento se muestra la
apertura; terminado, un cierre de agradecimiento.

**Agenda y Expositores.** Se quita el contenedor de título; queda solo el
cronograma en filas compactas —miniatura de los expositores, hora, leyes y
título— que caben en pantalla sin desplazamiento. Al tocar una fila se abre un
**modal** con el detalle completo: resumen de la sesión y, por cada expositor,
foto, cargo, biografía y **dos códigos QR**: el de su perfil/contacto y el del
**sitio web de su empresa o institución**.

**Marco Legal.** Se quita el contenedor de título; las dos leyes pasan a ser
**tarjetas seleccionables** que abren su detalle (fechas, fiscalizador,
aspectos clave y la sesión donde se tratan) en el mismo modal.

**Expositores.**
- Bernardo Donoso y Leonardo Jadue exponen juntos y aparecen en el mismo bloque
  (sesión Lineage), con ambas fotos.
- Se añade la foto de Bernardo Donoso (embebida en el bundle, sin depender de un
  host externo) y una reseña nueva basada en su trayectoria como Director de TIC
  para Latinoamérica y Asesor TI para Asia, y Customer Success Manager en
  consultoría Microsoft.

**Códigos QR.** Regenerados desde sus URLs. El **QR de NextTime Software** ahora
dirige a `https://nexttimesoftware.com`. Los QR de empresa del modal apuntan al
sitio de cada organización (Nexo Abogados, NextTime, CustomerTrigger, Lineage).

**Pie.** El logo de Kimos pasa a ser el **logo completo** (isotipo + wordmark),
con las proporciones del logo oficial en fondo azul pero a menor escala, en
blanco, **sin el sufijo «.dev» y sin sombra**.

---

## Cambios de la versión 2.5.0

- **Modal de sesión más compacto.** Los expositores de una misma sesión van en
  un único contenedor: cada uno con su QR de perfil y un solo QR compartido por
  empresa (la sesión de Lineage pasa de 4 a 3 QR). La reseña de Bernardo Donoso
  se acortó para que el modal no quede tan alto.
- **QR del diagnóstico.** El modal de «Panel de Preguntas, Networking y Cierre»
  ya no muestra el QR de la agenda .ics; en su lugar lleva el QR del
  **formulario de diagnóstico** (Microsoft Forms) para responderlo en el móvil.
  El mismo QR se agrega en la **portada del diagnóstico** («Continúalo en tu
  móvil»).
- **Resultado sin scroll.** La pantalla de resultado del diagnóstico muestra
  solo el contenedor del resultado (puntaje, nivel y barra) y un botón **«Ver
  N brechas en detalle»** que abre el desglose de brechas y la normativa a
  priorizar en un **modal**, en lugar de desplegarlos hacia abajo.
