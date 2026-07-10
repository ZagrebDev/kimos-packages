# Prospección Comercial — FIGIT + KIMOS (App instalable de Kimos)

Conversión del dashboard HTML *Dashboard Prospección KIMOS + FIGIT* al modelo
plugin de Kimos (AppShell v1). Mismo panel comercial —59 prospectos por rubro,
embudo, KPIs, gráficos, filtros y bitácora— corriendo dentro de una ventana del
shell v2 y persistiendo el avance por instancia.

## Qué incluye

- **59 prospectos** (RETAIL, SALUD, EDUCACIÓN, BANCA, TRANSPORTE, GOBIERNO,
  TELECOM, MINERÍA, ENERGÍA, MANUFACTURA, AUTOMOTOR, HOTELERÍA, DEPORTE) con
  descripción, tomador de decisión, contacto, problemática y propuesta.
  Estos datos maestros van **embebidos** en el bundle (`SEED`).
- **KPIs** (total, por estado, por resultado, interacciones) y **embudo comercial**.
- **Gráficos** en SVG/HTML puro (sin Chart.js ni red): distribución de estados
  (dona), prospectos por rubro (barras) y carga por responsable (barras apiladas).
- **Filtros**: búsqueda, estado, responsable, resultado y chips por rubro.
- **Tabla** con fila expandible: ficha completa, notas propias y **bitácora de
  contacto** (fecha, canal, resumen, próximo seguimiento).
- **Equipo editable** (modal) y **Exportar / Importar / Reiniciar** el estado.

## Persistencia

El estado del usuario —`meta` (estado/resultado/responsable/notas por
prospecto), `bit` (bitácora) y `equipo`— se guarda con
`shell.saveData()` / `shell.loadData()` en `instance.json`, con guardado
debounceado a 600 ms. Como guarda datos, la app declara `multiInstance: true`.

```json
{
  "meta": { "1": { "estado": "Contactado", "resultado": "", "responsable": "Responsable 1", "notas": "" } },
  "bit":  [ { "empresa": "Cencosud...", "fecha": "2026-07-10", "canal": "Correo", "resumen": "…", "proximo": "" } ],
  "equipo": ["Sin asignar", "Responsable 1", "Responsable 2"]
}
```

## Estructura

```
prospeccion-comercial/
├── manifest.json       # metadatos (multiInstance, permisos instance.read/write)
├── README.md
└── dist/
    ├── index.js        # bundle ESM (usa globalThis.React, sin JSX)
    └── index.css       # estilos scopeados en .kimos-prospeccion
```

## Contrato del bundle

```js
export default function mount(shell) {
  return { Component };
}
```

Usa `globalThis.React` (expuesto por el shell) para no duplicar React. Sin paso
de build en el host: todo es `React.createElement`.

## Diferencias vs. el HTML original

- `localStorage` → `shell.saveData/loadData` (estado por instancia del equipo).
- Chart.js (CDN) → gráficos en SVG/HTML puro, autocontenidos (sin red en runtime).
- Estilos globales → scopeados bajo `.kimos-prospeccion`; la raíz ocupa 100 % y
  hace scroll interno dentro de la ventana del shell.

## Roadmap

- v1.1: acciones del agente IA (`agent.control`) sobre estados/bitácora.
- v1.2: `configSchema` (⚙️) para personalizar rubros y colores.
