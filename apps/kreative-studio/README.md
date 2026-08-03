# Kreative Studio 🎬

Estudio de **campañas publicitarias cinematográficas** generadas con IA, nativo
de KIMOS. No produce solo vídeos: produce la campaña completa.

Sube las fotos de un producto, escribe *«crea una campaña premium»*, y el
sistema entrega investigación, concepto, plan de funnel, storyboard con
dirección de fotografía, prompts por proveedor, guion de voz, brief de música,
timeline con script FFmpeg, control de marca, copy para todos los canales,
biblioteca de assets, versiones y analítica de costes.

```
Producto ──► Kreative Studio ──► Campaña completa
                    │
   Investigación · Concepto · Plan · Storyboard · Prompting · Voz · Música
   Producción · Edición · Marca · Copy · Landing · Email · Assets · Métricas
```

---

## Empezar

1. **Tienda → Kreative Studio → Instalar.** La app es `multiInstance`: cada
   documento es una campaña.
2. **Brief** → nombre del producto + fotos (frontal, tres cuartos, detalle).
   Marca la mejor como *principal*: es la referencia que reciben los modelos.
3. **Panel** → escribe la intención y pulsa **Generar campaña**.
4. **Producción** → la lista de trabajos con su prompt, proveedor y coste.
   Ejecútalos con tus modelos y registra cada resultado.
5. **Editor** → descarga el script de montaje, los subtítulos y el EDL.

Desde el chat de KIMOS, lo mismo en una frase:

> «Crea una campaña premium para el Vector Pro con estas fotos, en 9:16 y 16:9,
> y dame los prompts de vídeo para Veo.»

---

## Qué genera exactamente

| Entregable | Detalle |
|---|---|
| **Investigación** | Mercado, tendencias, público con objeciones y disparadores, competencia con el hueco que deja cada uno, nicho, códigos visuales y benchmarks por canal. |
| **Concepto** | Idea, mensaje clave, arco narrativo, emociones, atributos → beneficios → prueba, *money shot* y moodboard con paleta, óptica y referencias. |
| **Plan** | Funnel de cuatro etapas con reparto de presupuesto, canales, calendario de cuatro semanas, KPIs con objetivo razonado y plan de pruebas A/B. |
| **Storyboard** | Escenas con duración, encuadre, ángulo, óptica, movimiento, iluminación, etalonaje, efectos, velocidad, transición, rótulo y nota de sonido. Cortes por formato y variantes con hipótesis. |
| **Prompts** | Imagen y vídeo por escena, en el dialecto del proveedor elegido, con negativo y parámetros. Exportables en CSV. |
| **Voz y música** | Locución ajustada al metraje plano a plano, dirección actoral, brief de música con estructura y notas de mezcla, ambiente y efectos. |
| **Producción** | Trabajos ordenados (keyframes → tomas → audio) con dependencias, cantidad facturable y coste estimado por proveedor. |
| **Edición** | Timeline multipista, subtítulos SRT, lista EDL y **script FFmpeg completo**: normalización, etalonaje, transiciones, títulos, logotipo, mezcla con *ducking*, `loudnorm` y exportación a todos los formatos. |
| **Marca** | Auditoría con puntuación y hallazgos accionables: paleta, contraste WCAG, tipografía, logotipo, bloqueo de producto y personaje, tono, términos prohibidos y coherencia del montaje. |
| **Copy** | Anuncios por plataforma con variantes y ganchos distintos (respetando los límites de caracteres reales), landing completa con objeciones y SEO, y secuencia de cinco emails. |
| **Analytics** | Coste estimado frente a real por proveedor, consumo, y proyección de impresiones, CTR, CPA y ROAS con el ajuste creativo explicado. |

Formatos de salida: **1080 · 2K · 4K** × **16:9 · 9:16 · 1:1 · 4:5 · 2.39:1**,
etiquetados por plataforma de destino.

---

## Proveedores intercambiables

Ningún agente conoce a un proveedor concreto. Producen un **PromptSpec
neutral** (sujeto, acción, entorno, cámara, óptica, luz, etalonaje, efectos,
paleta, formato, duración) y el registro lo traduce al dialecto de cada modelo.

| Capacidad | Proveedores incluidos |
|---|---|
| Imagen | OpenAI Images · Midjourney · FLUX · Stable Diffusion · ComfyUI · Higgsfield |
| Vídeo | Runway · Kling · Veo · Sora · Higgsfield |
| Voz | ElevenLabs · OpenAI TTS |
| Música / efectos | Suno · Udio · ElevenLabs SFX |
| Texto | Claude · OpenAI · Gemini · OpenRouter |

Cambiar de Runway a Veo reescribe los prompts de toda la campaña y no toca
nada más. Añadir un modelo nuevo es añadir un descriptor: ver
[`docs/PROVIDERS.md`](docs/PROVIDERS.md).

---

## Control por el agente de KIMOS

La app declara `agent.control` con 23 herramientas. Flujo típico:

```
SET_BRIEF → ADD_PRODUCT_PHOTO → GENERATE_CAMPAIGN
          → GET_JOBS → (generas con tus modelos) → REGISTER_ASSET
          → EXPORT bible | ffmpeg | srt | prompts_csv | copy_csv
```

`REGISTER_ASSET` cierra el ciclo: asocia el archivo a su escena, versiona las
iteraciones, marca el trabajo como completado y sustituye el coste estimado por
el real. Lista completa en [`docs/AGENTES.md`](docs/AGENTES.md).

---

## Desarrollo

```bash
node apps/kreative-studio/build.mjs           # src/*.js → dist/index.js
node apps/kreative-studio/test/test-app.mjs   # 170 comprobaciones
node tools/pack.mjs apps/kreative-studio      # → kreative-studio-1.0.0.kapp
```

El `.kapp` de la versión publicada vive en la raíz del repo
(`kreative-studio-1.0.0.kapp`), como el de `productlab`. **Al subir `version` en
el manifest hay que regenerarlo**, o el archivo de sideload queda desfasado
respecto al `dist/` que instala la Tienda.

`dist/index.js` se **genera**: edita `src/`, nunca el bundle. Los fragmentos de
`src/` comparten ámbito y se concatenan en orden por su prefijo numérico
(`00`–`34` dominio y aplicación, `40`–`58` adaptadores y UI dentro de `mount`).

Documentación: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) ·
[`docs/PROVIDERS.md`](docs/PROVIDERS.md) · [`docs/AGENTES.md`](docs/AGENTES.md) ·
[`docs/PRODUCCION.md`](docs/PRODUCCION.md)

---

## Límites, dichos sin rodeos

- **La app no llama a los modelos generativos.** Un bundle de KIMOS corre en el
  navegador del usuario y no puede custodiar claves de API de terceros. Kreative
  Studio produce los prompts, los parámetros y los trabajos; quien los ejecuta
  es el agente de KIMOS (con sus MCP, p. ej. Higgsfield) o el operador. El
  resultado vuelve con `REGISTER_ASSET`.
- **El script FFmpeg no se ejecuta aquí**, se entrega. Está validado como shell
  y su filtergraph se comprueba estáticamente en los tests (pads producidos y
  consumidos), pero el render ocurre en tu máquina o en tu CI.
- **Las cifras de medios son proyecciones**, derivadas de benchmarks públicos
  por familia de plataforma y del ajuste creativo del propio storyboard. Sirven
  para dimensionar y comparar variantes, no son un compromiso de resultado.
- **Todo el pipeline es determinista y funciona sin red.** El mismo brief
  produce la misma campaña, que es lo que permite comparar versiones.
