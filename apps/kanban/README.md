# 🗂️ Kanban — app oficial instalable

Migración 1:1 del Kanban del producto al contrato AppShell (v3.0.0).
COMPATIBLE con las instancias existentes: mismas columnas en
`instance.config.columns` y mismas tarjetas en los items.

- Tablero por columnas con drag&drop nativo (mover entre columnas y reordenar).
- Editor de tarjeta: descripción, fechas, responsable (actores del workspace),
  entidades habilitadas y campos extra de la instancia.
- Gestión de columnas (añadir/renombrar/color/orden/eliminar/bloquear) —
  solo admins del equipo.
- Filtros por búsqueda, responsable y atributo.
- Agente IA: CREATE_CARD / MOVE_CARD / UPDATE_CARD / DELETE_CARD
  (`shell.agent.register`, requiere permiso `agent.control`).
