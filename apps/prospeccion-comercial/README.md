# Prospección Comercial — FIGIT + KIMOS (App instalable de Kimos)

Conversión del dashboard HTML *Dashboard Prospección KIMOS + FIGIT* al modelo
plugin de Kimos (AppShell v1). Mismo panel comercial —59 prospectos por rubro,
embudo, KPIs, gráficos, filtros y bitácora— corriendo dentro de una ventana del
shell v2 y persistiendo el avance por instancia.

## Qué incluye

- **59 prospectos base** (RETAIL, SALUD, EDUCACIÓN, BANCA, TRANSPORTE, GOBIERNO,
  TELECOM, MINERÍA, ENERGÍA, MANUFACTURA, AUTOMOTOR, HOTELERÍA, DEPORTE) con
  descripción, tomador de decisión, contacto, problemática y propuesta.
  Estos datos maestros van **embebidos** en el bundle (`SEED`).
- **Sumar prospectos** de dos formas (se guardan en `store.custom`, en el navegador):
  - **➕ Manual**: formulario individual (sólo la empresa es obligatoria).
  - **🗄️ Cargar BD**: importación masiva desde **JSON** o **CSV**
    (Excel → *Guardar como CSV*; acepta separador `,`, `;` o tabulador, comillas
    y acentos). Columnas reconocidas por nombre (es/en): `empresa`, `rubro`,
    `persona`/`contacto`, `cargo`, `telefono`, `correo`/`email`, `linkedin_url`,
    `descripcion`, `problematica`, `propuesta`, `notas`. Botón **📄 Plantilla**
    descarga un CSV de ejemplo con las columnas.
  - Los prospectos añadidos muestran una etiqueta **añadido** y se pueden
    **eliminar** desde su ficha (los 59 base no).
- **KPIs** (total, por estado, por resultado, interacciones) y **embudo comercial**.
- **Gráficos** en SVG/HTML puro (sin Chart.js ni red): distribución de estados
  (dona), prospectos por rubro (barras) y carga por responsable (barras apiladas).
- **Filtros**: búsqueda, estado, responsable, resultado y chips por rubro.
- **Tabla** con fila expandible: ficha completa, notas propias y **bitácora de
  contacto** (fecha, canal, resumen, próximo seguimiento).
- **Equipo editable** (modal) y **Exportar / Importar / Reiniciar** el estado.

## Persistencia (sin instancias por equipo)

App **singleton** (`multiInstance: false`): no crea instancias por equipo. El
estado del usuario —`meta` (estado/resultado/responsable/notas por prospecto),
`bit` (bitácora), `equipo` y `custom` (prospectos añadidos)— se guarda en el
**navegador** con `localStorage` (clave `kimos_prospeccion_v1`), con guardado
debounceado a 400 ms. **Exportar** descarga un respaldo completo (incluye los
prospectos añadidos) e **Importar** lo restaura; úsalo para mover todo entre
navegadores o equipos. **Reiniciar** borra sólo el avance y **conserva** los
prospectos añadidos.

```json
// localStorage["kimos_prospeccion_v1"]
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

- Chart.js (CDN) → gráficos en SVG/HTML puro, autocontenidos (sin red en runtime).
- Estilos globales → scopeados bajo `.kimos-prospeccion`; la raíz ocupa 100 % y
  hace scroll interno dentro de la ventana del shell.
- Render con `React.createElement` sobre `globalThis.React` (sin JSX / sin build).
- Persistencia en `localStorage` conservada (misma clave `kimos_prospeccion_v1`),
  igual que el HTML: sin instancias por equipo.

## Roadmap

- v1.x: `configSchema` (⚙️) para personalizar rubros y colores.
- Variante `multiInstance: true` con `shell.saveData/loadData` si se quiere
  estado por equipo/instancia (ver historial de git, v1.0.0).
