# Kimos FunPlai (`funplai`)

**Versión actual: 1.18.0** — la app la muestra en su portada (`v1.18.0`, junto
al nombre), así se sabe de un vistazo qué build quedó instalado al probar. El
número vive en **cuatro** lugares que van siempre juntos:

1. `manifest.json` de la app (`version`);
2. la constante `APP_VERSION` de `dist/index.js` (la que pinta el chip y sella
   cada partida del ranking);
3. el **catálogo raíz del repo** (`/manifest.json` → `apps[] → funplai`), que es
   lo que lee la Tienda de KIMOS: **si este no sube, no aparece la
   actualización** aunque el resto esté al día;
4. esta línea del README y la tabla de versiones del final.

Verifícalo con `node tools/check-versions.mjs funplai` antes de commitear.

App de juegos interactivos para **tótem, PC, tablet y móvil**: pantalla táctil,
cámara con detección de pose y pistola tipo lightgun. La interfaz se adapta al
tamaño y a la orientación, y todos los juegos con cámara traen control táctil o
de teclado equivalente. Ambientada por defecto en las Fiestas Patrias de Chile,
con toda la temática, textos y dificultad editables desde la propia app.

| Juego | Entrada | Encuadre | Puntaje |
|---|---|---|---|
| Coloca la cola al burro | Táctil | — | 0–10 por distancia al centro de una mira móvil |
| Prueba de baile | Cámara + pose (33 puntos) **o modo rítmico por toque/teclado** | Cuerpo completo (solo modo cámara) | Postura por ángulos + ritmo; en modo rítmico, notas acertadas + precisión |
| LaserGun dieciochero | Pistola IR / puntero / dedo | — | Empanada +20, choripán +15, volantín +10; ají y schop restan |
| Rayuela Chilena | Deslizar (estilo Golf Clash) o cámara | Medio cuerpo | Reglas oficiales: quemada = 2 pts, tejo más cercano = 1 pt |
| Boxeo | Cámara o botones | Medio cuerpo | Daño al canguro o al boxeador humano, con guardia y esquiva |
| Gato | Táctil | — | Se elige en pantalla rival (tótem con minimax o 2 jugadores) y ficha: cruces o círculos |
| Mete gol | Cámara (patada) o deslizar | Cuerpo entero | Penales contra un arquero que patrulla el arco y se lanza |
| Esquiva y gana | Cámara, botones o teclado | Medio cuerpo | Carrera lateral 2D: saltar y agacharse |
| Esquiva y gana 3D | Cámara, botones o teclado | Medio cuerpo | Obstáculos de frente; el avatar es el contorno del cuerpo |
| Alas de cóndor | Cámara (aletear), botones o teclado | Medio cuerpo superior | Se vuela moviendo los brazos como alas y se planea abriéndolos en cruz |
| Alas de cóndor 3D | Cámara (aletear e inclinar), botones o teclado | Medio cuerpo superior | Ruta por el valle de los Andes: se vira inclinando el torso |

**Los once se pueden jugar sin cámara.** La entrada alternativa no es un
respaldo para equipos sin cámara: es la capa de accesibilidad, puntúa igual y
entra al mismo ranking. La tabla juego por juego, con encuadre y dependencia del
color, está en `docs/ACCESIBILIDAD.md` del repositorio.

Los juegos con cámara, salvo el modo cámara del baile y el de Mete gol,
necesitan ver **solo el medio cuerpo superior** —torso, brazos y cabeza—, y
todos comparten una única zona marcada a 2,2 m del tótem: se calibra una vez y
nadie se mueve entre juego y juego. En la Rayuela la pantalla **es la cancha**:
primero muestra el área de posicionamiento, calibra por el ancho de hombros y
luego proyecta dónde cae el tejo dentro del cajón de 1×1 m —o fuera.

Los juegos con cámara comparten un **espacio de juego declarado** (240 × 220 ×
250 cm por defecto) que convierte la cámara RGB en instrumento de medida:
distancia, estatura, envergadura y largos de segmento en centímetros, más los 33
puntos de articulación y la separación de la persona del fondo. En **📐 Espacio**
se declara qué cámara está instalada —integrada, gran angular de 90°, ultra
ancha de 120°, PTZ con gimbal o de profundidad— y la app compara todas contra el
montaje real y dice cuál sirve para medio cuerpo y cuál para cuerpo entero.

El seguimiento del participante es **digital**: el lente no se mueve y el
recorte que sigue a la persona se hace por software, así que se consigue el
encuadre de una cámara con gimbal sin perder la referencia geométrica que
permite medir en centímetros.

## Cámara a cualquier altura, y teléfono como cámara

La altura y la inclinación de la cámara se **deducen**, no se declaran: en
🎥 Diagnóstico hay una autocalibración que recupera montajes de **60 a 200 cm**
—exacta con el plano del piso del Kinect, estimada con dos posiciones si es una
cámara corriente— y ajusta la marca del piso y el alto de la franja a la
estatura de quien juega. Así la misma app sirve en un tótem de 180 cm, en una
tablet a 120 y en un teléfono en trípode a 60 para que jueguen niños. El
teléfono (Iriun o DroidCam) está en el catálogo de cámaras con su lente normal
y su ultra ancho.

## Cuerpo completo

Los juegos de cuerpo leen el tren inferior cuando está a la vista: el paso
adelante suma fuerza al tejo en la rayuela, Esquiva 3D trae muros laterales que
se esquivan dando un paso, los vuelos del cóndor pican juntando las piernas y
frenan abriéndolas, y el salto se mide con la cadera en vez de los hombros. Si
la cámara no ve las piernas, cada juego sigue con la señal de siempre.

## Con Kinect for Xbox One (v2)

Además de la webcam, la app puede leer el cuerpo con un **Kinect v2** a través
de un puente local por WebSocket. El sensor aporta lo que una cámara RGB no
puede dar: 25 articulaciones **en metros reales**, hasta 6 cuerpos, estado de
cada mano (puño, abierta o señalando), orientación de cada hueso, inclinación
del torso medida por el propio sensor y el **plano del piso**.

| Juego | Qué gana con el Kinect |
|---|---|
| Boxeo | El golpe exige **puño cerrado**; esquivar usa la inclinación del sensor |
| Rayuela | El tejo se suelta cuando la mano **se abre**, no por tiempo estimado |
| Alas de cóndor y 3D | El aleteo se mide en metros; virar usa la inclinación |
| Mete gol | Usa la articulación del **pie** y cuánto avanza hacia la pantalla |
| Esquiva y gana y 3D | Salto y agachada contra el **suelo real**, sin calibrar |
| LaserGun | Modo **apuntar con la mano**: el brazo es la pistola y el puño el gatillo |

Se elige en **⚙️ Editor → 🔌 Hardware → Motor de pose**; en `auto` prueba el
puente y cae a la webcam si no está. Ahí mismo se ajustan las **propiedades del
sensor** —con cuál de las seis personas que ve se juega, rango de distancia,
suavizado del esqueleto, y si se usan el plano del piso, la inclinación del
torso y el estado de las manos— y un botón prueba el puente al momento. El
Kinect también está en el catálogo de cámaras de **📐 Espacio**, con el campo
de su sensor de profundidad, así que el análisis del montaje lo evalúa como a
cualquier otra.

El puente entrega además la **imagen** del sensor, así que el Kinect reemplaza
a la webcam por completo sin perder el esqueleto. El Kinect **no aparece en la
lista de cámaras del sistema** aunque esté funcionando: no es una webcam, y
exponerlo como tal necesitaría un driver de cámara virtual que además tiraría a
la basura el esqueleto, los metros y el plano del piso. Durante la partida un indicador dice si se juega
con 🦴 Kinect o con 📷 Webcam, y si se pidió Kinect y el puente no responde el
juego avisa y sigue con la cámara en vez de quedarse muerto. El Kinect v2 **no entrega esqueleto de
dedos** —la mano son muñeca, punta y pulgar más el estado—, y su seguimiento de
cuerpo solo existe en el SDK de Windows. Sin Kinect, todos los juegos siguen
funcionando igual con la cámara.

## Accesibilidad: la entrada alternativa es la capa de accesibilidad

Los once juegos se juegan sin cámara, y esa entrada **puntúa igual y entra al
mismo ranking**. Prueba de baile —que fue durante mucho tiempo la excepción de
la tabla— trae un **modo rítmico**: la misma coreografía, las notas cayendo a
una línea y el compás sacado del `bpm` y los `beats` que ya estaban escritos, así
que una coreografía nueva escrita en el editor queda jugable por toque sin
agregar un dato. El carril de cada nota sale de la pose del paso, se distinguen
por ancho y posición (no por color), y hay un modo de **un solo botón** para
pulsador único, una mano o la barra espaciadora.

Cuando dos entradas del mismo juego miden cosas distintas, **la fila del ranking
lo dice**: el detalle de una partida por toque empieza por «Modo rítmico
táctil», también en el CSV. Comparten ranking, no fingen ser la misma prueba.

## Modo sensor remoto: el teléfono como cámara

El teléfono hace de cámara sin instalar nada, ni en él ni en el equipo de la
pantalla. La pantalla muestra un código de sala y un QR, el teléfono abre la app
en su navegador y se empareja. El teléfono calcula la pose ahí mismo y transmite
solo los **33 puntos del cuerpo** —unos 700 bytes por cuadro—, por WebRTC
directo con respaldo por el puente local. La imagen no sale del teléfono, y no
por promesa: por el enlace no cabe, lo único que se serializa son landmarks.

## Modo concurso, cuando el juego reparte un premio

El vigilante mira durante **toda** la partida, no solo al calibrar, y separa las
dos formas reales de inflar un puntaje: acercarse y girarse. Hay tres resultados
y no dos —limpia, señalada e inválida—, porque quien se giró tres segundos
porque le hablaron no hizo trampa. El desempate es determinista y está escrito,
y cada partida queda sellada con fecha, sesión, versión de la app, motor de pose
y veredicto, exportable a CSV. Plantilla de bases en `docs/BASES-CONCURSO.md`.

## Datos: semáforo estricto

**Verde** y siempre: contadores agregados —cuánta gente se acercó a cada juego,
partidas, abandonos, repeticiones, afluencia por hora, tiempo de ciclo—. Cuentan
cuántas veces pasó algo, no a quién, así que se le entregan enteros al
auspiciador sin permiso de nadie. **Amarillo** y solo si la persona lo pide: el
contacto se ofrece *después* de jugar, plegado, sin casillas marcadas y con la
finalidad de cada una en texto claro; sin una casilla marcada no se guarda ni el
nombre. **Rojo**, y no por limitación técnica: no se estima edad, género,
emoción ni conducta, y no se reidentifica a nadie entre partidas. Todo en
`docs/PRIVACIDAD.md`, alineado con la Ley 21.719.

## Packs temáticos

Vienen cuatro —dieciochero, verano, navidad y neutro corporativo— y se aplican
con un toque desde el Editor; están además como archivos versionados en
`assets/packs/`. Un pack cambia **cómo se ve y cómo se llaman las cosas** y
**no toca** el montaje (cámara, espacio, hardware) ni los datos (ranking,
contactos, métricas): por eso se puede cambiar la decoración a mitad de una
jornada sin arriesgar una partida guardada. Un pack roto falla al importarlo,
con el campo y el motivo, en vez de romper la app en pleno evento.

Incluye ranking del tótem, editor completo (marca, juegos, espacio, hardware,
export e import de configuración) y una pantalla de **diagnóstico** que mide en
el equipo real qué cámara hay, cuántos FPS entrega, si detecta el cuerpo, cuánto
mide la persona que está al frente, si el puntero de la pistola es compatible y
el estado del puente Kinect (cuerpos, manos, inclinación y plano del piso).

- `multiInstance`: cada tótem o evento es un documento independiente.
- Permisos: `instance.read`, `instance.write`, `agent.control`.
- Agente: `LISTAR_JUEGOS`, `ABRIR_JUEGO`, `IR_A`, `CAMBIAR_TEMA`,
  `ACTUALIZAR_MARCA`, `CONFIGURAR_JUEGO`, `VER_RANKING`, `BORRAR_RANKING`.
  `getSnapshot()` incluye `version`, así el agente puede decir qué build corre.
  `BORRAR_RANKING` **no tiene rol ni PIN**: abre en el tótem el mismo
  `confirm()` que tendría que aceptar una persona. El agente pide, la persona
  confirma.
- Sin red en runtime: todo el arte es SVG embebido. El motor de pose se descarga
  solo si se usa el juego de baile, y su URL es configurable (puede
  auto-hospedarse en el tótem para operar sin internet).

Código fuente, documentación de hardware (cámaras RGB-D, cámaras de alta
velocidad, pistolas IR), privacidad y roadmap: repositorio **kimos-funplai**.

```bash
node tools/pack.mjs apps/funplai apps/funplai/funplai-1.18.0.kapp
node tools/check-versions.mjs funplai
```

## Historial de versiones

| Versión | Qué trae |
|---|---|
| **1.18.0** | **Modo rítmico táctil** en Prueba de baile: la misma coreografía sin cámara, con las notas cayendo a una línea y el compás sacado del `bpm` y los `beats` que ya estaban escritos. Cierra la última excepción de accesibilidad —**los once juegos se juegan sin cámara**— con opción de un solo botón para pulsador único y ajuste de la latencia del panel. Versión visible en la portada. |
| 1.17.0 | **Packs temáticos**: dieciochero, verano, navidad y neutro corporativo, aplicables con un toque y también como archivos versionados en `assets/packs/`. Un pack cambia cómo se ve y cómo se llaman las cosas, y **no toca** el montaje ni los datos. Import/export validado contra esquema. |
| 1.16.0 | **Métricas de activación** con semáforo de datos: contadores agregados sin dato personal (verde), consentimiento granular después de jugar y QR de puntaje (amarillo), y nada de edad, emoción ni reidentificación (rojo). Panel del auspiciador con export a CSV. |
| 1.15.0 | **Modo concurso**: vigilante de partida durante todo el juego, tres veredictos (limpia, señalada, inválida), desempate determinista, sello de auditoría por partida, tope de intentos y ventana de vigencia. |
| 1.14.0 | **Modo sensor remoto**: el teléfono hace de cámara sin instalar nada. Emparejamiento por código de sala y QR, WebRTC directo con respaldo por el puente local, y solo los 33 puntos del cuerpo por el enlace —la imagen no sale del teléfono. |
| 1.13.0 | **Luz y tiempo de ciclo**: medición de luminancia sobre la persona (no sobre el cuadro), ruido y contraluz, con umbrales editables; prueba de campo de 20 s que da veredicto; y medición del tiempo de ciclo, relevo y personas por hora. |
| 1.12.0 | **Robustez del pipeline de pose**: recorte a la zona de juego antes de mirar el cuadro, descarte de cuadros donde el cuerpo salta o un hueso se estira, filtro One Euro con parámetros medidos, gestos por trayectoria y confianza por grupo. |
| 1.11.0 | El ranking deja de perder partidas en silencio (miles en vez de 60, export a CSV y aviso antes de soltar una fila), y las acciones destructivas del agente piden confirmación en el tótem. |
| 1.10.0 | Cámara a cualquier altura (60–200 cm) por autocalibración, cuerpo completo en los juegos que lo aprovechan, e imagen del sensor por el puente Kinect. |
| 1.9.0 | El Kinect se elige y se ajusta desde la app, con prueba del puente al momento. |
| 1.8.0 | Soporte de Kinect for Xbox One (v2) por puente local. |
| 1.7.0 | Dos juegos de vuelo: Alas de cóndor lateral y 3D por los Andes. |
| 1.x | Los juegos anteriores, el editor, el ranking y el diagnóstico. |

Al publicar un cambio hay que subir el número en los cuatro lugares de arriba
—incluido el catálogo raíz `/manifest.json`, que es de donde la Tienda saca la
versión ofrecida— y anotar aquí qué trae: el host cachea el bundle por versión,
y el chip de la portada es lo que se mira para confirmar que el KIMOS de pruebas
ya tomó el build nuevo.
