# De los prompts al máster

Kreative Studio produce **todo lo que se puede producir de forma determinista**.
Lo que necesita GPU y claves de terceros se entrega como trabajos ejecutables.
Este documento explica cómo se cierra el ciclo.

---

## 1. Trabajos

El Video Producer convierte los prompts en trabajos ordenados:

```
keyframe  ── una imagen por escena. Ancla la forma del producto.
   ↓
shot      ── el vídeo, partiendo del keyframe. Si la escena excede el máximo
             del modelo, se parte en tomas encadenadas (continuation: true).
   ↓
audio     ── locución por escena, música y efectos.
```

**Genera primero todos los keyframes y valida el producto antes de gastar en
vídeo.** Un vídeo malo cuesta entre 10 y 30 veces más que la imagen que lo
habría evitado.

Cada trabajo trae: proveedor, prompt, negativo, parámetros, cantidad
facturable, unidad de coste, coste estimado, dependencias y estado.

## 2. Ejecución

Kreative Studio no llama a los modelos: un bundle en el navegador no puede
custodiar claves de API de terceros. Dos caminos:

**Desde el chat de KIMOS** — el agente lee `GET_JOBS`, genera con sus MCP
(Higgsfield y demás) y cierra cada trabajo con `REGISTER_ASSET`.

**A mano** — la vista **Producción** exporta el CSV de trabajos con el prompt y
los parámetros de cada uno, listo para el cliente de tu proveedor.

## 3. Consistencia entre planos

Lo que rompe una campaña generada con IA es que el producto cambie de forma
entre plano y plano. Cuatro defensas, en orden de eficacia:

1. **Fotos reales del producto** en el brief, con una marcada como principal.
   Viajan como `refImages` en cada prompt.
2. **Bloqueo de producto** (`Marca → Bloqueo de producto`): forma, materiales y
   marca en una frase. Se inyecta como `productNote` en todos los prompts.
3. **Bloqueo de personaje** si hay personas en más de un plano.
4. **Semilla fija** en el modelo de imagen (parámetro del proveedor).

La auditoría de marca avisa cuando falta cualquiera de las cuatro.

Si un plano falla dos veces, **cambia el encuadre antes que el prompt**: es más
rápido y suele ser el problema real.

## 4. Registro

```
REGISTER_ASSET { url, jobId, sceneId, providerId, costUsd, durationSec }
```

Hace cuatro cosas de una vez: guarda el asset asociado a su escena, lo versiona
(la segunda toma del mismo plano es `v2`, no un archivo suelto), marca el
trabajo como `done` y sustituye el coste estimado por el real en Analytics.

Marca como **aprobado** el asset que entra al montaje: es lo que distingue una
iteración descartada de la buena.

## 5. Montaje

La vista **Editor** entrega tres archivos:

| Archivo | Para qué |
|---|---|
| `montaje-*.sh` | Script FFmpeg completo, de las tomas al entregable final. |
| `*.srt` | Subtítulos. Guárdalos como `subs.srt` junto al script. |
| `*.edl` | Lista CMX3600 para importar el corte en tu NLE. |

Estructura de carpetas que espera el script:

```
render/SC01.mp4 …          una toma por escena
audio/vo-SC01.wav …        locución
audio/music.wav            música
audio/sfx-*.wav            efectos
brand/logo.png             logotipo con transparencia (opcional)
fonts/display.ttf, fonts/body.ttf
subs.srt
```

Qué hace, en seis pasos:

1. **Normaliza** cada toma: fps, velocidad (cámara lenta incluida), etalonaje
   del estilo y duración exacta de la escena.
2. **Concatena** con las transiciones del storyboard (`xfade` encadenado con
   los offsets calculados).
3. **Mezcla el audio**: música a −18 dB, locución a −6 dB con *ducking* por
   cadena lateral, efectos a −12 dB, y `loudnorm` a −14 LUFS (el estándar de
   las plataformas sociales).
4. **Rotula**: textos en pantalla con la tipografía y los colores de marca, y
   el logotipo respetando su área de reserva.
5. **Quema los subtítulos** (la mayoría del vídeo social se ve sin sonido).
6. **Exporta** cada formato y resolución con reencuadre por recorte central,
   `yuv420p` y `+faststart`.

El script se entrega, no se ejecuta aquí. Está validado como shell y su
filtergraph se comprueba estáticamente en los tests (cada pad se produce y se
consume una sola vez), pero el render ocurre en tu máquina o en tu CI.

Requisitos: FFmpeg con `libx264`, `xfade`, `sidechaincompress`, `loudnorm` y
`drawtext` (compilado con `--enable-libfreetype`).

## 6. Antes de invertir en medios

La lista de la vista Editor, que no es decorativa:

- El producto no cambia de forma entre planos consecutivos.
- El texto es legible dentro de la zona segura de cada formato vertical.
- La mezcla se ha escuchado en un móvil **y** con el sonido apagado.
- El logotipo respeta su área de reserva.

Y lo que dice Analytics: sin pieza vertical nativa se pierde en torno a un 12 %
de rendimiento en feeds móviles, y sin subtítulos otro 10 %. Ambas cosas se
arreglan antes de gastar el primer euro en medios.
