# 📊 Planificación (Gantt) — app oficial instalable

Migración 1:1 de la app del producto al contrato AppShell.
COMPATIBLE con las instancias existentes: mismos planes en los items
(tareas embebidas con `periods: boolean[]`) y misma configuración de
períodos/etiquetas en `instance.config`.

- Pestañas por plan + dashboard de avance (progreso, tareas por estado, atrasos).
- Línea temporal por períodos: **las fechas de inicio y fin de la tarea
  determinan y pintan los recuadros**; el clic en una celda define, extiende o
  encoge ese rango (y escribe las fechas correspondientes).
- Barra de avance 25/50/75/100, estados, responsables por tarea.
- Editor de plan (nombre, sigla, **descripción/objetivo**, responsable, color) y
  editor de tarea (responsable, estado, fechas, notas, atributos).
- Filtros por **período** y por **responsable**, y orden por **cualquier
  columna** — incluidas las columnas de período.
- Ajustes para admins: granularidad, cantidad de períodos, inicio, etiquetas de
  plan/tarea y qué tipos de atributos se muestran.

## Colaboración multiusuario (v4)

Varias personas pueden trabajar sobre el mismo documento a la vez y ver los
cambios de las demás sin recargar:

- **Sincronización periódica** (4 s con la ventana en foco, 15 s de fondo, en
  pausa si la pestaña no se ve), el mismo patrón que usan `contact-forms`,
  `productlab` o `miorg.buzon`, pero fusionando en vez de reemplazar.
- **Fusión sin pérdida**: gana la edición más reciente **tarea por tarea**
  (`updatedAt`/`updatedBy` por tarea, `metaUpdatedAt` para la cabecera del
  plan), no el último PUT del plan completo. Dos personas editando tareas
  distintas del mismo plan no se pisan.
- **Lápidas** (`deletedTasks`): una tarea borrada no reaparece desde la pantalla
  de otra persona que todavía la tenía cargada. Se purgan a los 30 días.
- **Guardado leer-fusionar-escribir**: cada guardado relee el plan del servidor,
  fusiona lo ajeno con lo propio y recién ahí escribe (el backend reemplaza el
  array `tasks` completo, así que la fusión tiene que pasar aquí).
- **Auto-reparación**: queda una ventana mínima —lo que tarda el viaje de red
  entre el read y el write— en la que otra escritura podría colarse y quedar
  pisada. Como el backend no ofrece escritura condicional, cada sesión repara lo
  suyo: si al sincronizar falta una tarea **propia y reciente** que nadie borró
  (o si una baja propia se deshizo), se vuelve a guardar sola en el siguiente
  ciclo. Está acotado a lo propio y reciente a propósito, para no resucitar
  nunca lo que borró otra persona.
- La UI no se repinta si el servidor no trae novedades (no molesta a quien está
  escribiendo), y un indicador muestra **En vivo / Guardando / Sin conexión**.

Todo esto vive **en el bundle**: no toca el backend, no requiere desplegar nada
en `kimos-enterprice` y no cambia el modelo de datos. Basta con que la instancia
actualice la app desde este repo.

## Agente IA

El agente puede hacer **todo lo que se puede hacer en la app**:

| Acción | Para qué |
|---|---|
| `ADD_GANTT` / `UPDATE_GANTT` / `DELETE_GANTT` | Crear, editar (nombre, sigla, **descripción/`objective`**, responsable, color) y eliminar planes |
| `SELECT_GANTT` | Abrir la pestaña de un plan |
| `ADD_TASK` / `UPDATE_TASK` / `DELETE_TASK` | Alta, edición completa y baja de tareas |
| `UPDATE_TASK_PROGRESS` / `UPDATE_TASK_STATUS` / `UPDATE_TASK_DATES` | Avance, estado y fechas |
| `SET_TASK_PERIOD` / `UPDATE_TASK_PERIODS` | Tramo de la tarea por períodos |
| `ASSIGN_ENTITY` | Atributos de una tarea |
| `SET_FILTER` / `SET_SORT` | Filtrar por responsable, período y atributos, y ordenar por columna |
| `SET_TIMELINE` / `SET_LABELS` | Línea temporal (admins) y etiquetas de plan/tarea |
| `RENAME_DOCUMENT` | Renombrar el documento abierto |

Los payloads aceptan los alias del contrato histórico (`ganttId`, `taskId`,
`periodIndex`, `description`, `ownerName`…), los nombres se resuelven de forma
tolerante (sin acentos, parciales) y los errores explican cómo corregir
(valores válidos y candidatos), para que el agente pueda reintentar solo.
