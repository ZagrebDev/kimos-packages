# Gantt — App instalable de Kimos

Planificación temporal: tareas en filas, períodos en columnas, barras
horizontales que marcan en qué períodos ocurre cada tarea. Persiste en
`/equipos/{teamId}/data/{instanceId}/instance.json` vía `shell.saveData()` /
`shell.loadData()`.

## Forma de los datos

```json
{
  "templateId": "gantt",
  "name": "Roadmap 2027",
  "ownerTeamId": "general",
  "config": {
    "periods": [
      { "id": "p-1", "name": "Enero", "shortName": "E", "startDate": "2027-01-01", "endDate": "2027-01-31" },
      { "id": "p-2", "name": "Febrero", "shortName": "F", "startDate": "2027-02-01", "endDate": "2027-02-28" }
    ],
    "tasks": [
      {
        "id": "t-1",
        "name": "Diseñar landing",
        "periods": [true, false],
        "progress": 30,
        "status": "in_progress"
      }
    ]
  }
}
```

La migración v2 (`migrationVersion=2`) embebe los items legacy de Gantt
dentro de `config.tasks`, así que tableros migrados se abren con un solo
`loadData()`.

## Acciones

- Crear/editar/eliminar tareas (nombre + status)
- Crear/eliminar períodos
- Marcar/desmarcar períodos en los que aplica cada tarea (click en la celda
  o arrastrar para seleccionar un rango)
- Persiste todo con guardado debounceado a 600ms

## Limitaciones de esta v1.0.0

Funciones avanzadas del Gantt v1 que NO están todavía: asignación a usuarios,
fechas exactas por tarea, entidades/etiquetas globales, campos extra,
data sources, granularidad automática, acciones del agente IA. Cualquiera
se añade en sucesivos bumps del bundle.
