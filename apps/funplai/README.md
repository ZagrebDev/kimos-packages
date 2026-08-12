# Kimos FunPlai (`funplai`)

App de juegos interactivos para tótem: pantalla táctil, cámara con detección de
pose y pistola tipo lightgun. Ambientada por defecto en las Fiestas Patrias de
Chile, con toda la temática, textos y dificultad editables desde la propia app.

| Juego | Entrada | Puntaje |
|---|---|---|
| Coloca la cola al burro | Táctil | 0–10 por distancia al centro de una mira móvil |
| Prueba de baile | Cámara + pose (33 puntos) | Postura por ángulos + sincronía con el ritmo |
| Lanza y acierta | Táctil, gesto o tracker externo | 0–10 por cercanía a la lienza |
| LaserGun dieciochero | Pistola IR / puntero absoluto / dedo | Puntos por blanco, con combo y penalización |
| Rayuela Chilena | Cuerpo + cámara (o deslizamiento) | Reglas oficiales: quemada = 2 pts, tejo más cercano = 1 pt |

En la Rayuela la pantalla del tótem **es la cancha**: primero muestra el área de
posicionamiento del participante, calibra su escala corporal y luego lee el
gesto de lanzamiento para proyectar dónde cae el tejo dentro del cajón de 1×1 m
—o fuera de sus márgenes.

Incluye ranking del tótem, editor completo (marca, juegos, hardware, export e
import de configuración) y una pantalla de **diagnóstico** que mide en el equipo
real qué cámara hay, cuántos FPS entrega, si detecta el cuerpo y si el puntero
de la pistola es compatible.

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
node tools/pack.mjs apps/funplai     # → funplai-1.1.0.kapp
```
