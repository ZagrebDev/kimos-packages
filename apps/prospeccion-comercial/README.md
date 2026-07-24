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
  - **🗄️ Cargar BD**: importación masiva desde **Excel `.xlsx`** (lector nativo,
    sin dependencias ni red), **CSV** (separador `,`, `;` o tabulador, comillas y
    acentos) o **JSON**. Columnas reconocidas por nombre (es/en): `empresa`, `rubro`,
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

## Investigación y actualización de contactos

**Actualización de datos de contacto**: todos los campos de la ficha (empresa,
rubro, persona, cargo, teléfono, correo, LinkedIn, descripción, problemática,
propuesta) son editables con **✏️ Editar ficha** — también los 59 base, cuyos
cambios se guardan como *overrides* (el SEED del bundle nunca se toca). Cada
ficha expandida trae además botones 🔎 de investigación con búsquedas pre-armadas.

**Control por agente (`agent.control`)**: la app registra tools para el agente
de la plataforma KIMOS — `UPDATE_PROSPECTO`, `ADD_PROSPECTO`, `SET_ESTADO`,
`SET_RESULTADO`, `SET_RESPONSABLE`, `ADD_NOTA`, `ADD_BITACORA` + `getSnapshot`.
Así, un agente autorizado puede **investigar en la web los datos de contacto y
actualizarlos automáticamente** en el tablero (la investigación web vive en el
agente/backfront de KIMOS; el bundle del navegador no puede rastrear la web por
CORS — igual que el widget del triatlón, cuyo cerebro es kimos.dev).

## Foto del contacto (📷)

Cada prospecto tiene un campo `foto` con avatar en la tabla (iniciales si no
hay imagen) y un bloque **📷 Foto del contacto** en la ficha expandida y en el
modal ✏️, con tres vías:

1. **Subir foto** (archivo/cámara): se recorta a cuadrado 160×160 JPEG en el
   navegador (canvas) para que quepa holgada en `localStorage`.
2. **URL / LinkedIn**: abre el perfil (💼), clic derecho sobre la foto →
   *“Copiar dirección de la imagen”* → pégala. La app la muestra al instante;
   **verifica visualmente que corresponda a la persona real** (la app no puede
   garantizar la coincidencia; LinkedIn no permite extracción automática desde
   el navegador).
3. **Agente KIMOS**: `UPDATE_PROSPECTO` acepta `campos.foto` (URL) — un agente
   autorizado puede investigar el perfil y asignar la imagen verificada.

`foto` también se importa por BD (columna `foto`/`photo`/`imagen`/`avatar`) y
viaja en Exportar/Importar. Las fotos subidas a mano se reportan al snapshot
del agente como `"(foto subida manualmente)"` (el data URI no se filtra).

## Notas de versión

- **2.2.0** — Campo **foto del contacto**: avatar con iniciales, subida manual
  (recorte cuadrado en canvas), URL de LinkedIn pegada, columna `foto` en BD y
  `campos.foto` en `UPDATE_PROSPECTO` para el agente.
- **2.1.0** — Se retira el widget de chat embebido (la conversación vive en el
  agente de la plataforma KIMOS, vía `agent.control`). Se mantienen la edición
  de fichas, los enlaces 🔎 y las 7 tools del agente.
- **2.0.0** — **Ficha 100 % editable** (overrides para los 59 base); enlaces 🔎
  de investigación por prospecto; **control por agente KIMOS** (`agent.control`,
  7 tools + snapshot) para investigar y actualizar contactos automáticamente.
  (Incluía un chat embebido, retirado en 2.1.0.)
- **1.4.0** — Soporte **Excel `.xlsx` nativo**: lector propio sin dependencias
  (descompresión DEFLATE + lectura ZIP + parseo del XML de Excel; lee la 1ª hoja,
  shared strings, acentos y entidades). Fix: el modal de alta usa
  `position: absolute` (antes `fixed`, que las ventanas del shell —con `transform`—
  recortaban, dejándolo invisible). `accept` del selector ampliado (`.xlsx`, CSV,
  TSV, TXT, JSON). `.xls` antiguo (binario) no soportado → guardar como `.xlsx`/CSV.
- **1.2.0** — Alta manual (➕) e importación de base de datos (JSON/CSV) + plantilla.
- **1.1.0** — App singleton (sin instancias por equipo); persistencia en navegador.
- **1.0.0** — Conversión del HTML a app instalable de Kimos.

## Roadmap

- v1.x: `configSchema` (⚙️) para personalizar rubros y colores.
- Variante `multiInstance: true` con `shell.saveData/loadData` si se quiere
  estado por equipo/instancia (ver historial de git, v1.0.0).
