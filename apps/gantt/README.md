# 📊 Planificación (Gantt) — app oficial instalable

Migración 1:1 de la app del producto al contrato AppShell (v3.0.0).
COMPATIBLE con las instancias existentes: mismos planes en los items
(tareas embebidas con `periods: boolean[]`) y misma configuración de
períodos/etiquetas en `instance.config`.

- Pestañas por plan + dashboard de avance (progreso, tareas por estado).
- Línea temporal por períodos (click en la celda para marcar/desmarcar).
- Barra de avance 25/50/75/100, estados, responsables por tarea.
- Editor de tarea: fechas reales, notas y entidades habilitadas.
- Ajustes de línea temporal para admins (granularidad, cantidad, inicio).
- Agente IA: ADD_GANTT / ADD_TASK / UPDATE_TASK_PROGRESS /
  UPDATE_TASK_STATUS / SET_TASK_PERIOD / DELETE_TASK / DELETE_GANTT.
