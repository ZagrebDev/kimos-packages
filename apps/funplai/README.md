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

Incluye ranking del tótem, editor completo (marca, juegos, espacio, hardware,
export e import de configuración) y una pantalla de **diagnóstico** que mide en
el equipo real qué cámara hay, cuántos FPS entrega, si detecta el cuerpo, cuánto
mide la persona que está al frente y si el puntero de la pistola es compatible.

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
node tools/pack.mjs apps/funplai apps/funplai/funplai-1.7.0.kapp
```
