# Kanban — App instalable de Kimos

Tablero visual de tareas con columnas configurables. Versión instalable (vía
`kimos-packages`) del Kanban clásico de Kimos. Lee/escribe los datos de la
instancia desde `/equipos/{teamId}/data/{instanceId}/instance.json` usando
`shell.saveData()` / `shell.loadData()`.

## Forma de los datos

```json
{
  "templateId": "kanban",
  "name": "Mi tablero",
  "ownerTeamId": "general",
  "config": {
    "columns": [
      { "id": "todo", "name": "Por hacer", "color": "#94a3b8" },
      { "id": "doing", "name": "En curso", "color": "#3b82f6" },
      { "id": "done", "name": "Hecho", "color": "#22c55e" }
    ],
    "cards": [
      {
        "id": "c-1",
        "name": "Diseñar landing",
        "description": "Hero + features",
        "column": "doing",
        "order": 0
      }
    ]
  }
}
```

La migración v2 (a partir de `migrationVersion=2`) embebe los items legacy
de Kanban dentro de `config.cards` para que la app pueda abrir tableros
históricos con un solo `loadData()`.

## Acciones

- Crear/editar/eliminar columnas (nombre + color)
- Crear/editar/eliminar tarjetas (título + descripción)
- Mover tarjetas entre columnas y reordenarlas con drag & drop nativo (HTML5)
- Persiste todo en `instance.json` con un guardado debounceado a 600ms

## Limitaciones de esta v1.0.0

Funciones avanzadas del Kanban v1 que NO están todavía: asignación a usuarios,
fechas start/end con calendario, entidades/etiquetas globales, campos extra,
data sources, acciones del agente IA. Cualquiera de esas puede añadirse en
sucesivas versiones del bundle (subir versión en `manifest.json` y `dist/`,
push a `main`, "Actualizar" desde la Tienda del shell v2).
