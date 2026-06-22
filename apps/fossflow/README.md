# FossFLOW 🧊

App instalable de Kimos: **creador de diagramas de flujo isométricos**, inspirado
en [FossFLOW](https://github.com/stan-smith/FossFLOW) / Isoflow. Lienzo reactivo y
orientado a estado (*State-Driven*), editable por el usuario y controlable por un
agente autorizado.

## Modelo de estado (FossFLOW)

El lienzo se gobierna por un único objeto JSON que se persiste por instancia:

```jsonc
{
  "title": "Diagrama de flujo",
  "nodes": [
    { "id": "n-…", "label": "API", "type": "service", "x": 0, "y": 0, "z": 0, "color": "#f59e0b", "icon": "⚙️" }
  ],
  "connections": [
    { "id": "c-…", "from": "n-…", "to": "n-…", "label": "HTTP", "color": "#94a3b8" }
  ]
}
```

- **Nodos:** id único, `type` (color base), coordenadas discretas en la grilla
  `(x, y, z)` y metadatos (`label`, `color`, `icon`). `z` es la elevación.
- **Conexiones:** flujo `from → to` por id de nodo, con `label`, `color`, `dashed`
  (punteada) y `bidir` (bidireccional).

Tipos: `server`, `database`, `cloud`, `service`, `user`, `process`, `decision`,
`data`, `generic`.

## Iconos generalistas (librería libre + importados)

El icono de cada nodo es libre — `icon = { kind, value }`:

- **emoji** — catálogo offline por categorías (flujo, red, datos, personas,
  negocio, lugares, símbolos).
- **iconify** — buscador sobre [Iconify](https://iconify.design) (200k+ iconos
  libres: `mdi:server`, `logos:aws`, `tabler:*`, …). Requiere conexión.
- **url** — imagen/SVG importada por URL o `data:` URI.

El agente puede pasar `icon` como string (emoji, id de Iconify o URL) y se
normaliza automáticamente.

## Render (Isoflow core, sin WebGL)

- **Proyección isométrica 2:1** en SVG puro: `project(x,y,z)` mapea la grilla plana
  a los ejes isométricos; `unproject()` invierte para el *snapping* al arrastrar.
- Nodos: **icono sobre una baldosa isométrica** (no cajas), con sombra y anillo de
  selección. Conexiones: **líneas ortogonales sobre la grilla** con flecha
  (y flecha inversa si son bidireccionales). Sin Three.js.

## Interacción

- **Doble clic** en el lienzo → crear nodo en la celda (con snapping).
- **Arrastrar** un nodo → mover con auto-ajuste a la grilla.
- **Conectar** → arrastra el **puerto ⊕** de un nodo seleccionado hasta otro, o
  activa el modo **🔗 Conectar** (clic origen → clic destino).
- **Arrastrar el fondo** → desplazar (pan); **rueda** → zoom; **⤢** ajusta a contenido.
- **Inspector** → cambiar icono, etiqueta, tipo, color, coordenadas; duplicar o
  eliminar; estilo de conexión (punteada / bidireccional).
- **Atajos:** `Supr`/`Backspace` borra, `Esc` cancela, `Ctrl/Cmd+D` duplica.
- **Exportar / Importar** el diagrama como JSON (`⤓` / `⤒`).

## Integración reactiva con el agente

La app expone tools al AgentBridge (`agent.control`). Un agente autorizado puede
mutar el modelo en segundo plano y **el lienzo se repinta de inmediato** (UI y
agente comparten el mismo estado y el mismo flujo de mutación → guardado):

- `ADD_NODE { label?, type?, icon?, x?, y?, z?, color? }` — `icon`: emoji, id de
  Iconify (`mdi:server`, `logos:aws`) o URL.
- `UPDATE_NODE { id, label?, type?, icon?, x?, y?, z?, color? }`
- `MOVE_NODE { id, x, y, z? }`
- `DELETE_NODE { id }`
- `ADD_CONNECTION { from, to, label? }`
- `UPDATE_CONNECTION { id, label?, color?, dashed?, bidir? }`
- `DELETE_CONNECTION { id }`
- `SET_TITLE { title }`
- `SET_MODEL { model }` — reemplaza el diagrama completo (generación masiva)
- `CLEAR` / `GET_STATE`

`getSnapshot()` devuelve el modelo actual (ids, tipos, coords y conexiones) para
que el agente conozca el estado antes de actuar.

## Implementación

Bundle ESM autocontenido (`dist/index.js` + `dist/index.css`) que usa
`globalThis.React` (expuesto por el host) y cumple el contrato `AppShellV1`
(`mount(shell) -> { Component, unmount }`). **No requiere paso de build.**
Persistencia vía `shell.saveData/loadData` (instance.json, `config.model`).

Es `multiInstance`: cada diagrama es una instancia. Desde HomeLauncher → **Apps**
→ *FossFLOW* → **Nueva** se crea un diagrama por equipo.
