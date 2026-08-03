# Los agentes

## Los 12 especialistas

Cada agente es independiente: declara qué necesita (`requires`), qué sección
escribe (`writes`) y se ejecuta con `run(campaign, ctx)` devolviendo **solo** su
fragmento. No conoce a los demás, no toca el DOM y no hace IO.

| # | Agente | Escribe | Requiere | Qué produce |
|---|---|---|---|---|
| 1 | **Creative Director** | `concept` | — | Atributos, beneficios con su prueba, emociones, arco narrativo, logline, idea, mensaje clave, *money shot*, moodboard y reglas de dirección. |
| 2 | **Research Agent** | `research` | — | Mercado y tendencias, público con comportamiento/objeciones/disparadores, competencia con su hueco, nicho, códigos visuales y benchmarks por canal. |
| 3 | **Campaign Planner** | `plan` | `research` | Funnel de cuatro etapas con reparto exacto de presupuesto, canales, proyección por etapa, calendario y KPIs razonados. |
| 4 | **Storyboard Generator** | `storyboard` | `concept` | Escenas con duración, encuadre, ángulo, óptica, movimiento, luz, etalonaje, efectos, velocidad, transición, rótulo y nota de sonido. Cortes por formato y variantes con hipótesis. |
| 5 | **Prompt Engineer** | `prompts` | `storyboard` | PromptSpec neutral por escena traducido al dialecto del proveedor, con negativo, parámetros y avisos. |
| 6 | **Voice Director** | `audio` | `storyboard` | Locución **ajustada al metraje** plano a plano, dirección actoral, brief de música con estructura y mezcla, ambiente y efectos. |
| 7 | **Video Producer** | `production` | `prompts` | Trabajos ejecutables: keyframes → tomas (encadenadas si exceden el modelo) → audio, con dependencias y coste. |
| 8 | **Video Editor** | `edit` | `storyboard` | Timeline multipista, SRT, EDL y script FFmpeg completo con todos los entregables. |
| 9 | **Brand Consistency** | `brandCheck` | `storyboard` | Auditoría con puntuación 0-100 y hallazgos accionables por severidad. |
| 10 | **Copywriter** | `copy` | `concept` | Anuncios por plataforma con variantes y ganchos distintos, landing completa y secuencia de cinco emails. |
| 11 | **Asset Manager** | `shell.items` | — | Imágenes, vídeos, audio, documentos y logotipos con escena, proveedor, versión, coste y aprobación. |
| 12 | **Analytics** | `analytics` | `production` | Coste estimado vs. real por proveedor, consumo, y proyección de impresiones, CTR, CPA y ROAS con el ajuste creativo explicado. |

Orden de ejecución (`PIPELINE_ORDER`):

```
research → creative-director → planner → storyboard → prompt-engineer
        → voice-director → copywriter → video-producer → video-editor
        → brand-consistency → analytics
```

Si pides un agente cuya dependencia falta, el orquestador la ejecuta antes.

---

## Herramientas para el agente de KIMOS

### Brief y generación

| Tool | Para qué |
|---|---|
| `GENERATE_CAMPAIGN` | **La principal.** Genera la campaña completa desde una intención en lenguaje natural. Acepta `productName`, `usp` y `photos` en la misma llamada. |
| `SET_BRIEF` | Producto, categoría, precio, USP, público, presupuesto, mercado, idioma, competencia, obligatorios, legal. |
| `ADD_PRODUCT_PHOTO` | Adjunto del chat, ruta `/api/…` o URL pública. Deduplica y permite marcar la toma principal. |

### Dirección y ejecución

| Tool | Para qué |
|---|---|
| `RUN_AGENT` | Ejecuta un agente concreto y sus dependencias. |
| `RUN_PIPELINE` | Pipeline completo o parcial, sin reinterpretar la intención. |
| `SET_DIRECTION` | Estilo, objetivo, público o categoría. Regenera lo que dependa. |
| `SET_PROVIDER` | Cambia el proveedor de una capacidad y reescribe los prompts a su dialecto. |
| `SET_SETTINGS` | Duraciones, variantes, fps, subtítulos, formatos, resoluciones y plataformas. |
| `SET_BRAND` | Paleta, tipografías, logotipo, tono, eslogan, prohibidos, bloqueo de producto y personaje. |
| `REGISTER_PROVIDER` | Da de alta un modelo nuevo en caliente con una plantilla. |

### Storyboard

| Tool | Para qué |
|---|---|
| `UPDATE_SCENE` | Duración, encuadre, ángulo, óptica, movimiento, luz, color, efectos, rótulo, descripción, transición. Recalcula tiempos y propaga a prompts, audio, montaje y analítica. |
| `ADD_SCENE` | Inserta una escena por rol, opcionalmente tras un código concreto. |
| `REMOVE_SCENE` | Elimina y renumera. |

### Consulta y producción

| Tool | Para qué |
|---|---|
| `GET_PROMPTS` | Prompts listos, filtrables por tipo y escena. Con `providerId` los reescribe a ese modelo **sin cambiar los ajustes**. |
| `GET_JOBS` | Trabajos pendientes con prompt, parámetros y coste. |
| `REGISTER_ASSET` | Registra el archivo generado, lo versiona, cierra el trabajo y contabiliza el coste real. |
| `LIST_ASSETS` | Assets registrados con escena, proveedor, versión y coste. |
| `SET_JOB_STATUS` | `pending · running · done · failed · skipped`. |
| `ADD_COST` | Consumo real suelto (coste, tokens, segundos, imágenes). |
| `GET_COPY` | Anuncios (filtrables por plataforma), landing, emails o ganchos. |

### Entregables y versiones

| Tool | Para qué |
|---|---|
| `EXPORT` | `bible` · `ffmpeg` · `srt` · `edl` · `prompts_csv` · `copy_csv` · `jobs_csv` · `json` |
| `CREATE_VERSION` / `RESTORE_VERSION` | Instantáneas etiquetadas de la campaña completa. |

---

## Flujo completo desde el chat

```
SET_BRIEF { productName: "Vector Pro", usp: "Carbono. 180 g. Impermeable.", budget: 12000 }
ADD_PRODUCT_PHOTO { url: "<adjunto del chat>", isHero: true }
GENERATE_CAMPAIGN { intent: "Quiero un comercial épico para deportistas que convierta" }

GET_JOBS { status: "pending", kind: "image" }
   → generas los keyframes con tu modelo
REGISTER_ASSET { url: "...", jobId: "job-image-sc01", costUsd: 0.19 }

GET_JOBS { status: "pending", kind: "video" }
   → animas cada keyframe
REGISTER_ASSET { url: "...", jobId: "job-video-sc01", durationSec: 5, costUsd: 1.25 }

EXPORT { what: "ffmpeg" }   → montas y exportas los entregables
EXPORT { what: "bible" }    → el documento que se entrega al cliente
```

## Reglas del despachador

- **Todo input se valida.** Enumeraciones desconocidas se rechazan con la lista
  de valores válidos en el mensaje de error; nunca se escriben a medias.
- **Nunca lanza.** Cualquier excepción vuelve como `{ success: false, error }`.
- **Los cambios se propagan solos.** Editar una escena regenera prompts, audio,
  producción, montaje, auditoría y analítica.
- **`getSnapshot` incluye lo necesario para actuar**: códigos de escena, ids de
  trabajo, ids de versión y los proveedores disponibles por capacidad.
