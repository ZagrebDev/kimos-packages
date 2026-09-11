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

Kreative Studio no llama a los modelos por su cuenta: un bundle en el navegador
no puede custodiar claves de API de terceros. Quien genera es el agente, y la
app le da el trabajo masticado.

**Desde el chat de KIMOS** — «produce el material pendiente». El agente entra
en el ciclo `RUN_PRODUCTION` → generar → `REGISTER_ASSETS` y lo repite hasta
que no queda nada. Cada lote llega con el proveedor, el prompt, los parámetros,
la imagen de referencia y el archivo de destino ya resueltos; no tiene que
deducir nada ni respetar el orden por su cuenta, porque la app solo le entrega
lo que ya se puede hacer.

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
REGISTER_ASSETS { assets: [ { jobId, url, costUsd, durationSec }, … ] }
```

Hace cuatro cosas de una vez: guarda cada asset asociado a su escena, lo
versiona (la segunda toma del mismo plano es `v2`, no un archivo suelto), marca
su trabajo como `done` y sustituye el coste estimado por el real en Analytics.

El estado no se fía de que alguien pase el `jobId`: se **reconcilia** con lo que
hay en la Biblioteca cada vez que cambia algo. Borrar un asset reabre su
trabajo; recalcular la producción no borra el progreso; y un archivo de una
configuración anterior no cierra un trabajo que no es suyo, porque el id del
trabajo incluye la escena y no solo su código.

Marca como **aprobado** el asset que entra al montaje: es lo que distingue una
iteración descartada de la buena.

## 5. Montaje

La vista **Editor** entrega tres archivos:

| Archivo | Para qué |
|---|---|
| `*-render.sh` | **El bundle**: descarga los assets registrados a su sitio, une las tomas partidas, escribe los subtítulos y monta. Un solo comando. |
| `*-assets.json` | Manifiesto: qué archivo generado corresponde a cada ruta del montaje. |
| `montaje-*.sh` | Solo el montaje, si prefieres colocar los archivos tú. |
| `*.srt` · `*.edl` | Subtítulos sueltos y lista CMX3600 para tu NLE. |

Con el bundle basta con:

```bash
bash mi-campana-render.sh     # baja, une, subtitula y renderiza
```

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

El script se entrega, no se ejecuta dentro de KIMOS, pero **sí está probado**:
`test/test-render.mjs` fabrica los assets con FFmpeg, los sirve por HTTP,
ejecuta el bundle tal cual y comprueba que el .mp4 resultante tiene las
dimensiones, el fps, el audio y la duración declarados.

Requisitos: FFmpeg con `libx264`, `xfade`, `sidechaincompress`, `loudnorm`,
`subtitles` y `drawtext` (este último necesita `--enable-libfreetype`; algunos
builds estáticos no lo traen, y la prueba lo detecta y avisa).

### Por qué el máster dura menos que la suma de los planos

`xfade` **solapa** los clips: una transición de medio segundo se come medio
segundo de metraje. La duración final es `suma de planos − suma de
transiciones`, y todo lo que va sobre la imagen —locución, rótulos y
subtítulos— se coloca en ese tiempo, no en el nominal del storyboard.

No es un detalle: con tres transiciones de medio segundo el desfase pasa de un
segundo al final, y la voz deja de cuadrar con la imagen. Lo descubrió el
primer render real, no la lectura del código.

## 6. Antes de invertir en medios

La lista de la vista Editor, que no es decorativa:

- El producto no cambia de forma entre planos consecutivos.
- El texto es legible dentro de la zona segura de cada formato vertical.
- La mezcla se ha escuchado en un móvil **y** con el sonido apagado.
- El logotipo respeta su área de reserva.

Y lo que dice Analytics: sin pieza vertical nativa se pierde en torno a un 12 %
de rendimiento en feeds móviles, y sin subtítulos otro 10 %. Ambas cosas se
arreglan antes de gastar el primer euro en medios.
