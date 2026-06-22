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
- **Conexiones:** flujo `from → to` por id de nodo, con `label`, `color`,
  `width` (grosor), `style` (`solid`/`dashed`/`dotted`) y puntas independientes
  por extremo `arrowStart`/`arrowEnd` (`none`/`arrow`/`dot`).

Tipos: `server`, `database`, `cloud`, `service`, `user`, `process`, `decision`,
`data`, `generic`.

## Área de trabajo (cuadrícula delimitada)

El diagrama vive sobre una **cuadrícula acotada** `grid = { w, h }` (en celdas).
Toda coordenada de nodo se mantiene **dentro** del área (`x∈[0,w]`, `y∈[0,h]`):

- Editable desde el botón **▦ w×h** de la barra (ancho/alto, mostrar líneas).
- El botón **⤢** encuadra el área completa (útil cuando el agente genera flujos
  grandes: ya no se pierden lejos de la vista).
- Si se importa o el agente envía un diagrama con coordenadas enormes o negativas,
  la cuadrícula **se reencuadra y crece** para que todo quepa dentro; al achicarla,
  los nodos se reubican al borde. Siempre se trabaja sobre la cuadrícula.

## Iconos nativos (sin dependencias de red)

El icono de cada nodo es libre — `icon = { kind, value }`:

- **builtin** — set de iconos **embebido en el propio bundle** (≈128 iconos de
  [Lucide](https://lucide.dev), licencia ISC), agrupado por categorías (flujo,
  red/infra, dispositivos, datos, personas/negocio, seguridad, lugares,
  sistema). **No depende de ninguna URL externa en runtime.** Los SVG fuente
  viven en [`icons/`](./icons) y se incrustan en `dist/index.js` (ver
  `icons/LICENSE.md`). Se tiñen con el color del nodo (`currentColor`).
- **emoji** — catálogo offline por categorías (alternativa universal).
- **url** — icono propio: imagen/SVG por URL o `data:` URI (importación
  iniciada por el usuario, no es una dependencia).

El agente puede pasar `icon` como string: una **clave nativa** (`server`,
`database`, `user`, `cloud`, `shield`, …), un emoji, o una URL. `GET_STATE`
expone `iconKeys` con todas las claves disponibles. Diagramas antiguos que
usaban ids de Iconify (`mdi:server`) se migran automáticamente a la clave
nativa equivalente.

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
- **Editar conexión** → clic sobre la línea: etiqueta, color, **grosor**, **tipo
  de línea** (sólida/discontinua/punteada), **puntas** por extremo
  (flecha/punto/ninguna) e **invertir sentido**.
- **Inspector** → cambiar icono, etiqueta, tipo, color, coordenadas; duplicar o
  eliminar.
- **Atajos:** `Supr`/`Backspace` borra, `Esc` cancela, `Ctrl/Cmd+D` duplica.
- **Exportar / Importar** el diagrama como JSON (`⤓` / `⤒`).

## Integración reactiva con el agente

La app expone tools al AgentBridge (`agent.control`). Un agente autorizado puede
mutar el modelo en segundo plano y **el lienzo se repinta de inmediato** (UI y
agente comparten el mismo estado y el mismo flujo de mutación → guardado):

- `ADD_NODE { label?, type?, icon?, x?, y?, z?, color? }` — `icon`: clave nativa
  (`server`, `database`, `user`, `cloud`, `shield`…), emoji o URL.
- `UPDATE_NODE { id, label?, type?, icon?, x?, y?, z?, color? }`
- `MOVE_NODE { id, x, y, z? }`
- `DELETE_NODE { id }`
- `ADD_CONNECTION { from, to, label?, color?, width?, style?, arrowStart?, arrowEnd? }`
- `UPDATE_CONNECTION { id, label?, color?, width?, style?, arrowStart?, arrowEnd? }`
  — `style` ∈ `solid|dashed|dotted`, `arrow*` ∈ `none|arrow|dot`.
- `DELETE_CONNECTION { id }`
- `SET_GRID { w, h }` — redimensiona el área de trabajo (cuadrícula).
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
