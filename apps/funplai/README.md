# Kimos FunPlai (`funplai`)

App de juegos interactivos para **tótem, PC, tablet y móvil**: pantalla táctil,
cámara con detección de pose y pistola tipo lightgun. La interfaz se adapta al
tamaño y a la orientación, y todos los juegos con cámara traen control táctil o
de teclado equivalente. Ambientada por defecto en las Fiestas Patrias de Chile,
con toda la temática, textos y dificultad editables desde la propia app.

| Juego | Entrada | Encuadre | Puntaje |
|---|---|---|---|
| Coloca la cola al burro | Táctil | — | 0–10 por distancia al centro de una mira móvil |
| Prueba de baile | Cámara + pose (33 puntos) | Cuerpo completo | Postura por ángulos + sincronía con el ritmo |
| LaserGun dieciochero | Pistola IR / puntero / dedo | — | Empanada +20, choripán +15, volantín +10; ají y schop restan |
| Rayuela Chilena | Deslizar (estilo Golf Clash) o cámara | Medio cuerpo | Reglas oficiales: quemada = 2 pts, tejo más cercano = 1 pt |
| Boxeo | Cámara | Medio cuerpo | Daño al canguro o al boxeador humano, con guardia y esquiva |
| Gato | Táctil | — | Se elige en pantalla rival (tótem con minimax o 2 jugadores) y ficha: cruces o círculos |
| Mete gol | Cámara (patada) o deslizar | Cuerpo entero | Penales contra un arquero que patrulla el arco y se lanza |
| Esquiva y gana | Cámara, botones o teclado | Medio cuerpo | Carrera lateral 2D: saltar y agacharse |
| Esquiva y gana 3D | Cámara, botones o teclado | Medio cuerpo | Obstáculos de frente; el avatar es el contorno del cuerpo |

Los juegos con cámara, salvo el baile y Mete gol, necesitan ver **solo el medio cuerpo
superior** —torso, brazos y cabeza—, así que se juegan a ~1,5 m del tótem y
funcionan en espacios reducidos. En la Rayuela la pantalla **es la cancha**:
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

Incluye ranking del tótem, editor completo (marca, juegos, espacio, hardware,
export e import de configuración) y una pantalla de **diagnóstico** que mide en
el equipo real qué cámara hay, cuántos FPS entrega, si detecta el cuerpo, cuánto
mide la persona que está al frente, si el puntero de la pistola es compatible y
el estado del puente Kinect (cuerpos, manos, inclinación y plano del piso).

- `multiInstance`: cada tótem o evento es un documento independiente.
- Permisos: `instance.read`, `instance.write`, `agent.control`.
- Agente: `LISTAR_JUEGOS`, `ABRIR_JUEGO`, `IR_A`, `CAMBIAR_TEMA`,
  `ACTUALIZAR_MARCA`, `CONFIGURAR_JUEGO`, `VER_RANKING`, `BORRAR_RANKING`.
- Sin red en runtime: todo el arte es SVG embebido. El motor de pose se descarga
  solo si se usa el juego de baile, y su URL es configurable (puede
  auto-hospedarse en el tótem para operar sin internet).

Código fuente, documentación de hardware (cámaras RGB-D, cámaras de alta
velocidad, pistolas IR), privacidad y roadmap: repositorio **kimos-funplai**.

```bash
node tools/pack.mjs apps/funplai apps/funplai/funplai-1.10.0.kapp
```
