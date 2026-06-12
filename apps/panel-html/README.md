# Panel HTML

Primera app instalable real del modelo plugin de Kimos (Fase 4 del refactor v2).

## Qué es

Edita HTML libre y lo visualiza en un iframe `sandbox="allow-scripts allow-forms allow-modals"`. Cada instancia se guarda como `instance.json` bajo `/equipos/{teamId}/data/{instanceId}/` vía `AppShell.saveData()`.

## Cómo instalarla

Front 2.0 activado → **Tienda** → buscar "Panel HTML" → **Instalar**. El backend descarga este `dist/` a GCS y registra la app en Firestore.

## Estructura

```
panel-html/
├── manifest.json       # metadatos
└── dist/
    ├── index.js        # bundle ESM (sin compilar — usa globalThis.React)
    └── index.css       # estilos
```

## Contrato del bundle

```js
export default function mount(shell) {
  return { Component, unmount? };
}
```

El bundle usa `globalThis.React` (expuesto por el shell del sistema) para evitar duplicar React y romper hooks. Persiste vía `shell.saveData({ html })` y carga con `shell.loadData()`.

## Roadmap

- v1.0: editor + iframe + persistencia (esto).
- v1.1: integración con agentBridge (acciones del agente sobre el panel).
- v1.2: data sources del shell.
- v1.3: versión pública compartida (puerto desde el PanelHTML v1).
