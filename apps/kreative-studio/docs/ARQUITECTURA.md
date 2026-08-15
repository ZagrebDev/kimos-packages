# Arquitectura

## La restricción que manda

Una app de KIMOS es, por contrato (`APP-SPEC.md`), **un bundle ESM que se
ejecuta en el navegador** dentro del shell: `globalThis.React`, sin paso de
build en el host, sin servidor propio, con persistencia, archivos y agentes
provistos por el objeto `shell`.

Eso descarta un backend Python con FastAPI, Celery, PostgreSQL y Docker: no hay
sitio donde desplegarlo ni forma de instalarlo desde la Tienda. Kreative Studio
traslada cada pieza de ese stack a su equivalente real de la plataforma:

| Pieza del stack clásico | Equivalente en KIMOS |
|---|---|
| FastAPI (API de orquestación) | `shell.agent.register` — 29 tools que el agente de la empresa invoca |
| Celery + Redis (cola de tareas) | Pipeline de agentes puros (ms) + **trabajos por lotes** para lo caro: `RUN_PRODUCTION` entrega el lote listo y `REGISTER_ASSETS` lo liquida |
| PostgreSQL / Prisma | `shell.saveData` (documento de campaña) + `shell.items` (assets y ledger de costes) |
| MinIO / S3 | `POST /api/v2/files` → `/api/public/files/{path}` |
| Next.js + Tailwind + Shadcn | Componentes `React.createElement` + CSS con ámbito `.kimos-kreative` |
| Docker / DevOps | Empaquetado `.kapp` e instalación desde la Tienda |
| FFmpeg en servidor | **Bundle de render** generado: descarga de assets + unión de tomas + subtítulos + FFmpeg, en un solo script |

Lo que se pierde es ejecutar los modelos desde el propio servicio; lo que se
gana es que la app se instala en un clic, hereda RBAC, equipos, ventanas,
documentos, versiones y agente sin escribir una línea de infraestructura.

---

## Capas

```
┌─ Dominio · scope de módulo, sin React, sin IO ──────────────────────────┐
│  05-util        utilidades puras, PRNG determinista, formato, WCAG      │
│  10-vocab       encuadres, ángulos, ópticas, movimientos, luz, grades,  │
│                 efectos, transiciones, formatos, plataformas y sus      │
│                 límites reales de copy y benchmarks                     │
│  12-styles      10 direcciones creativas completas + objetivos          │
│  14-knowledge   11 categorías de mercado, 8 públicos, parser de         │
│                 intención en lenguaje natural                           │
│  16-providers   REGISTRO DE PROVEEDORES (Strategy + Registry)           │
│  17-ws-core ▲   formas, modos, departamentos y estructuras              │
│  19-ws-world ▲  mundo de la organización + mutaciones puras             │
│  20-model       agregado raíz Campaign + migración tolerante            │
│  21-ws-sim ▲    simulación de avatares (pura, un paso por llamada)      │
│  22-creative    Research · Creative Director · Campaign Planner         │
│  24-storyboard  Storyboard Generator                                    │
│  26-prompts     Prompt Engineer · Voice Director                        │
│  28-production  Video Producer · Video Editor (EDL, SRT, FFmpeg)        │
│  30-copy        Copywriter · Brand Consistency                          │
│  32-analytics   Analytics · exportaciones                               │
└────────────────────────────────────────────────────────────────────────┘
┌─ Aplicación · scope de módulo, puro ───────────────────────────────────┐
│  34-agents      los 12 agentes + orquestador del pipeline (DAG,        │
│                 estados, tiempos, autorresolución de dependencias)     │
└────────────────────────────────────────────────────────────────────────┘
┌─ Adaptadores + UI · dentro de mount(shell) ────────────────────────────┐
│  40-mount       estado por ventana, puertos (persistencia, archivos,   │
│                 notificación, config, documentos), carga y guardado    │
│  42-agent       tools del agente de KIMOS y su despachador             │
│  50-58          21 vistas; 55 es el Flujo (4 presentaciones) y 56 la    │
│                 Organización                                            │
│  53-ws-ui ▲     superficie animada del mundo (3 proyecciones)          │
└────────────────────────────────────────────────────────────────────────┘

▲ = fragmentos del paquete `packages/kimos-worldskin`, intercalados por el
build. No es una librería en tiempo de ejecución: se compilan aquí dentro.
Ver `packages/kimos-worldskin/docs/CONTRATO.md`.
```

El **tema** es solo tokens: dos clases y un puñado de variables CSS en la
raíz. Ningún componente sabe en qué modo está, así que añadir una piel nueva
no toca ninguna vista. Las dos excepciones deliberadas son el Flujo, que tiene
un renderizador por ambientación sobre el mismo modelo (`workflowPlan`) y las
mismas acciones, y la Organización, que proyecta el mismo mundo de tres formas
(villa cenital, hotel isométrico y territorio) sin mover una celda.

**Regla de dependencia**: hacia dentro. El dominio no sabe que existen React,
`shell` ni la red. Por eso los tests pueden ejercitar el sistema entero sin
navegador, y por eso el pipeline funciona igual sin conexión.

---

## El agregado Campaign

Un documento = una campaña. Cada agente escribe **su propia sección** y nunca
la de otro, lo que permite re-ejecutar un agente suelto sin perder el trabajo
manual del resto:

```js
{
  brief, styleId, objectiveId, audienceId, categoryId, brand, settings,
  research,    // Agente 2      concept,    // Agente 1
  plan,        // Agente 3      storyboard, // Agente 4
  prompts,     // Agente 5      audio,      // Agente 6
  production,  // Agente 7      edit,       // Agente 8
  brandCheck,  // Agente 9      copy,       // Agente 10
  analytics,   // Agente 12
  pipeline: { runs, stages }, versions, log
}
```

El **Agente 11 (Asset Manager)** es el único con estado externo: vive en
`shell.items` con dos tipos de item, `asset` y `cost`. Se separan del documento
porque crecen sin límite y porque el ledger de costes debe sobrevivir a una
restauración de versión.

`migrate()` normaliza cualquier documento cargado: rellena defaults, descarta
formatos y proveedores desconocidos (un bundle antiguo pudo guardar un
proveedor que ya no existe) y recorta historiales. Nunca lanza.

---

## Determinismo

`seedOf(campaign)` deriva una semilla de los datos del brief y la dirección; el
PRNG (`mulberry32`) reparte encuadres, ópticas y efectos a partir de ella. Dos
ejecuciones del pipeline con el mismo brief producen **exactamente** el mismo
storyboard.

No es un capricho: sin determinismo, «guardar versión» y «restaurar» no
comparan nada, y cualquier cambio de un parámetro se confunde con el ruido del
azar. El test lo verifica explícitamente.

---

## El orquestador

`runPipeline(campaign, { only })` recorre `PIPELINE_ORDER`, y para cada agente:

1. Comprueba `requires`; si falta una dependencia, **la ejecuta antes**
   (autorresolución: pedir solo `analytics` sobre una campaña vacía funciona).
2. Ejecuta `run(campaign, ctx)` capturando errores por etapa.
3. Escribe el resultado en `campaign[agent.writes]` y registra estado y tiempo.

Nunca muta la entrada: trabaja sobre una copia y devuelve `{ campaign, run }`.
Un agente que falla no derriba el pipeline; su etapa queda en `error` con el
mensaje, visible en el Panel.

`generateCampaign(campaign, intentText)` es el punto de entrada de alto nivel:
interpreta la frase del usuario (`parseIntent`), fija estilo, objetivo, público
y categoría, y lanza el pipeline completo.

---

## Reactividad

Un `Set` de listeners y una función `commit()`. La UI y el agente llaman a las
**mismas** funciones, así que cuando el agente de KIMOS edita una escena desde
el chat, la ventana se repinta sola. El guardado va con *debounce* de 700 ms.

El estado vive en el closure de `mount()`, nunca a nivel de módulo: dos
ventanas de la misma app son dos campañas independientes.

---

## Rendimiento

El pipeline completo son ~11 funciones puras sobre estructuras pequeñas: se
ejecuta en pocos milisegundos, medidos y visibles en el Panel. Lo caro —llamar
a los modelos— no está aquí: está en los **trabajos**, que se ejecutan fuera y
se liquidan con `REGISTER_ASSET`.

Por eso no hace falta una cola de tareas. Meter Celery aquí sería añadir
infraestructura para gestionar trabajo que dura menos que el propio *round
trip* de encolarlo.
