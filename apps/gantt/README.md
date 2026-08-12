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
- **Guardado leer-fusionar-escribir con CAS**: cada guardado relee el plan,
  fusiona lo ajeno y escribe con `_expectedUpdatedAt`; si alguien escribió en el
  intertanto el backend responde 409 y se reintenta sobre la copia fresca.
- La UI no se repinta si el servidor no trae novedades (no molesta a quien está
  escribiendo), y un indicador muestra **En vivo / Guardando / Sin conexión**.

Todo esto vive en el bundle: no requiere backend a medida ni cambia el modelo de
datos. El único apoyo del backend es el CAS opcional (`_expectedUpdatedAt`), que
si no estuviera disponible degrada a leer-fusionar-escribir a secas.

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
| `SET_FILTER` / `SET_SORT` | Filtrar por responsable/período y ordenar por columna |
| `SET_TIMELINE` / `SET_LABELS` | Línea temporal (admins) y etiquetas de plan/tarea |
| `RENAME_DOCUMENT` | Renombrar el documento abierto |

Los payloads aceptan los alias del contrato histórico (`ganttId`, `taskId`,
`periodIndex`, `description`, `ownerName`…), los nombres se resuelven de forma
tolerante (sin acentos, parciales) y los errores explican cómo corregir
(valores válidos y candidatos), para que el agente pueda reintentar solo.
