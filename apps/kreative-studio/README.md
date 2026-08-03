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

Una campaña nueva se abre por la vista **Guía**, que explica dentro de la propia
app qué hace, **qué no hace**, el flujo en cinco pasos y los errores que salen
caros. Está siempre disponible en el menú.

1. **Tienda → Kreative Studio → Instalar.** La app es `multiInstance`: cada
   documento es una campaña.
2. **Brief** → nombre del producto + fotos (frontal, tres cuartos, detalle).
   Marca la mejor como *principal*: es la referencia que reciben los modelos.
   Si el producto está en **ProductLab**, impórtalo y se rellena solo.
3. **Panel** → escribe la intención y pulsa **Generar campaña**.
4. **Producción** → pídeselo al agente: genera el material por lotes
   (keyframes → tomas → audio) y registra cada resultado con su coste real.
5. **Bundle de render** → un script que baja todo, une las tomas partidas,
   escribe los subtítulos y monta los entregables con FFmpeg.

Desde el chat de KIMOS, la campaña entera en dos frases:

> «Importa la Mesa Fiordo de ProductLab y hazle una campaña premium de 20
> segundos en 9:16 y 16:9.»
>
> «Produce todo el material pendiente y dame el bundle de render.»

---

## El flujo de agentes: visible, editable y con dos formas

La vista **Flujo** muestra los doce agentes con sus dependencias, su estado y
su último tiempo de ejecución. Y se puede **editar**: reordenar, desactivar
agentes y ejecutarlos sueltos.

Reordenar respeta las dependencias: un agente no puede ir antes de aquel del
que depende, y si lo intentas se coloca en la posición válida más cercana.
Desactivar un agente lo salta; los que dependían de él quedan **bloqueados con
el motivo**, en vez de fallar a medias.

El mismo flujo se puede ver de dos formas, con varios modos cada una:

| Forma | Modos |
|---|---|
| **Clásica** — estudio profesional | ☀️ Día · 🌇 Atardecer · 🌙 Noche · 🕰️ Vivo (sigue la hora del equipo) |
| **Juego** — el flujo, jugable | 🔬 KimosLab (ruta en píxeles con caja de diálogo) · 🏨 JABOTEL (sala isométrica) · 🛸 Spacecraft (consola de mando) |

Las cuatro presentaciones operan sobre **los mismos datos y con las mismas
acciones**: seleccionar, ejecutar, activar/desactivar y reordenar. El aspecto
no cambia nada del documento — hay una prueba que compara la huella completa
de la campaña antes y después de cambiar de piel.

Todo el decorado es CSS y SVG generados en el bundle: ni una imagen, ni una
fuente externa, ni una petición de red.

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

La app declara `agent.control` con 29 herramientas. El agente puede llevar la
campaña de cero al vídeo montado sin que toques la interfaz:

```
IMPORT_PRODUCT  (o SET_BRIEF + ADD_PRODUCT_PHOTO)
      ↓
GENERATE_CAMPAIGN «crea una campaña premium»
      ↓
RUN_PRODUCTION ──► lote: qué generar ahora, con qué modelo, con qué referencia
      │                   (el agente lo genera con sus conexiones)
      └── REGISTER_ASSETS ──► versiona, cierra trabajos, suma el coste real
      ↑                                                        │
      └──────────────── repetir hasta listo: true ◄────────────┘
      ↓
EXPORT render_bundle ──► descarga + unión de tomas + subtítulos + FFmpeg
```

`RUN_PRODUCTION` respeta las dependencias reales: no entrega una toma de vídeo
hasta que su keyframe existe, y se la pasa como imagen de referencia. Lista
completa en [`docs/AGENTES.md`](docs/AGENTES.md).

---

## Integración con ProductLab

Con el permiso `data.read:productlab` (solo lectura, y el RBAC del usuario es
siempre el techo), Kreative Studio importa un producto del catálogo:

| De ProductLab | Al brief |
|---|---|
| `name`, `sku` | Nombre del producto y trazabilidad del origen |
| `price` + moneda del catálogo | Precio y divisa |
| `storefront.specs[]` | Propuesta de valor (los atributos reales) |
| `groups[]` (pasos) | «Personalizable en: …», que es argumento de venta |
| `galleryImages[]` + foto de tienda | Fotos de referencia para los modelos |

No escribe nada en ProductLab.

---

## Desarrollo

```bash
node apps/kreative-studio/build.mjs              # src/*.js → dist/index.js
node apps/kreative-studio/test/test-app.mjs      # 256 comprobaciones, sin dependencias
node apps/kreative-studio/test/test-render.mjs   # render REAL (requiere ffmpeg)
node tools/pack.mjs apps/kreative-studio         # → kreative-studio-1.0.0.kapp
```

`test-render.mjs` genera una campaña, fabrica los assets con FFmpeg (patrones
de prueba, sin material externo), los sirve por HTTP, ejecuta el bundle **sin
tocarlo** y comprueba el .mp4 resultante. Si no hay `ffmpeg` en el PATH —o le
faltan filtros— se salta diciendo exactamente qué falta. Con `FFMPEG=/ruta`
puedes apuntar a un binario concreto.

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

- **La app no llama a los modelos por su cuenta.** Un bundle de KIMOS corre en
  el navegador del usuario y no puede custodiar claves de API de terceros. Quien
  genera es el agente de KIMOS con sus conexiones (MCP de Higgsfield y demás);
  la app le dice qué toca, con qué modelo y con qué referencia, y recoge el
  resultado. Para el usuario es una frase en el chat; la diferencia es de
  arquitectura, no de experiencia.
- **El render se prepara aquí y se ejecuta fuera.** El bundle se ha ejecutado
  de verdad (`test-render.mjs`) y produce un .mp4 con las dimensiones, el fps,
  el audio y la duración declarados; pero el render corre en tu máquina o en tu
  CI, no dentro de KIMOS. Necesita FFmpeg con `libx264`, `xfade`,
  `sidechaincompress`, `loudnorm`, `subtitles` y `drawtext`.
- **Las cifras de medios son proyecciones**, derivadas de benchmarks públicos
  por familia de plataforma y del ajuste creativo del propio storyboard. Sirven
  para dimensionar y comparar variantes, no son un compromiso de resultado.
- **Todo el pipeline es determinista y funciona sin red.** El mismo brief
  produce la misma campaña, que es lo que permite comparar versiones.
