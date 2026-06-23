# Cómo construir una App de Kimos (spec)

Guía de referencia para crear una **app instalable** de Kimos. Las apps viven en
`kimos-packages/apps/{id}/` y se ejecutan dentro del shell v2 de
`kimos-enterprice`. Ejemplos reales en este repo: `kanban`, `notas-equipo`,
`fossflow`.

> Estado del contrato: **AppShell v1** (vigente). Las capacidades de **AppShell
> v2** (botones ⚙️ Configurar / 🗂️ Documentos, assets, sideload `.kapp`) están
> planificadas en `kimos-enterprice/PLAN-apps-gestion-v2.md`; este documento
> marca con 🔭 lo que pertenece a v2.

---

## 1. Estructura de carpeta

```
apps/mi-app/
├─ manifest.json        (obligatorio)
├─ dist/
│  ├─ index.js          (obligatorio — bundle ESM, export default mount)
│  └─ index.css         (opcional — estilos, scope con una clase raíz)
├─ assets/              (🔭 v2 — iconos/imágenes servidos por el host)
└─ README.md            (recomendado)
```

Además, registra la app en el `manifest.json` **raíz** del repo (array `apps`)
para que el backend la liste e instale.

---

## 2. `manifest.json` (referencia de campos)

| Campo | Tipo | Req. | Descripción |
|-------|------|:---:|-------------|
| `id` | string | ✓ | Identificador único (kebab-case). Para sideload, usa namespace (`miorg.mi-app`). |
| `name` | string | ✓ | Nombre visible. |
| `version` | string | ✓ | SemVer. **Un bump reinstala el bundle** (el backend re-descarga). |
| `description` | string | ✓ | Texto para la Tienda. |
| `icon` | string | ✓ | Emoji o URL de imagen. |
| `author` | string | – | Autor. |
| `entry` | string | ✓ | Ruta del bundle (`dist/index.js`). |
| `css` | string | – | Ruta del CSS (`dist/index.css`). |
| `appShellApi` | string | ✓ | Compatibilidad: `"1.x"` (o `"2.x"` 🔭). |
| `multiInstance` | boolean | – | `true` = cada documento es una instancia (recomendado para apps con datos). |
| `permissions` | string[] | ✓ | Capacidades: `instance.read`, `instance.write`, `agent.control`. |
| `configSchema` | object | – | Esquema de parámetros (genera la UI de ⚙️ Configurar). Ver §3.1. |
| `defaultConfig` | object | – | Valores iniciales de los parámetros (siembra el form ⚙️). |

**Persistencia y permisos:** `saveData/loadData` y `shell.items` requieren
`teamId`+`instanceId`, que **solo existen en apps `multiInstance`**. Una app
singleton (sin `multiInstance`) **no persiste** por esos medios. Regla práctica:
*si tu app guarda datos, declara `multiInstance: true`.*

---

### 3.1 Chrome enriquecido: ⚙️ Configurar y 🗂️ Documentos (AppShell v2)

Desde la **Fase 6**, la barra de título de una app muestra, además de
minimizar/cerrar:

- **⚙️ Configurar** — si la app declara `configSchema`. El host genera un
  formulario y persiste los valores; la app los lee con `shell.config`.
- **🗂️ Documentos** — si la app es `multiInstance`. Menú *Nuevo / Abrir / Guardar
  / Renombrar / Eliminar / Cerrar* sobre las instancias de la app (no requiere
  código de la app).

**Formato de `configSchema`** (propio de Kimos, no JSON-Schema):

```jsonc
"configSchema": {
  "title": "Preferencias de Mi App",
  "fields": [
    { "key": "showGrid", "label": "Mostrar grilla", "type": "boolean" },
    { "key": "theme", "label": "Tema", "type": "select",
      "options": [ { "value": "light", "label": "Claro" }, { "value": "dark", "label": "Oscuro" } ] },
    { "key": "accent", "label": "Color", "type": "color" },
    { "key": "maxItems", "label": "Máximo", "type": "number", "min": 1, "max": 99 }
  ]
},
"defaultConfig": { "showGrid": true, "theme": "light", "accent": "#19ACB1", "maxItems": 20 }
```

Tipos de campo: `string`, `textarea`, `number`, `boolean`, `select`, `color`.
`defaultConfig` siembra los valores iniciales del form.

**Consumir la config en el bundle** (opcional, retrocompatible):

```js
if (shell.config && shell.config.get) {
  const s = await shell.config.get();         // { showGrid, theme, ... }
  applySettings(s);
  const off = shell.config.onChange(applySettings); // se notifica al guardar ⚙️
  // llama off() en unmount
}
```

Los parámetros se guardan en `config.settings` de la instancia (junto a tus
datos), así que `shell.loadData()` también los ve. Apps que no lean `shell.config`
igual muestran el botón ⚙️ y persisten los valores (los aplican cuando quieran).

**Documentos y versiones (🗂️):** el menú Documentos ofrece *Nuevo · Abrir ·
Guardar · Guardar versión · Guardar como · Historial (restaurar) · Renombrar ·
Eliminar · Cerrar* sobre las instancias de la app, sin código de la app. El
documento se guarda en `equipos/{teamId}/apps/{appId}/{instanceId}/document.json`
(versiones en `…/versions/{ts}.json`). Para soportar "Guardar versión" y
"Restaurar", la app puede declarar:

```js
if (shell.documents) {
  shell.documents.onSerialize(() => ({ model }));      // qué guardar
  shell.documents.onLoad((cfg) => hidratar(cfg.model)); // al restaurar una versión
}
```

## 3. El contrato `AppShell` (runtime)

El bundle exporta por defecto una función `mount(shell)`:

```js
export default function mount(shell) {
  const React = globalThis.React;       // el host expone React; NO lo empaquetes
  const h = React.createElement;        // sin JSX (no hay paso de build en el host)
  // ... construir estado, registrar agente, etc.
  return {
    Component,                          // React component que se renderiza
    unmount() { /* limpiar timers, listeners, agente */ },
  };
}
```

### `shell` (AppShellV1) — lo que recibes

| Miembro | Uso |
|---------|-----|
| `shell.app` | `{ appId, instanceId?, teamId? }` — identidad de la ventana. |
| `shell.window` | `setTitle()`, `requestClose()`, `requestMinimize()`. |
| `shell.notify({level,text})` | Toast (`info`/`success`/`warn`/`error`). |
| `shell.saveData(payload, scope?)` | Guarda config de la instancia (blob). Requiere `instanceId`. |
| `shell.loadData(scope?)` | Carga la config guardada. |
| `shell.items` | CRUD de subcolección por instancia: `list/create/update/remove`. |
| `shell.agent.register({...})` | Control por agente autorizado (ver §6). |
| 🔭 `shell.config` / `shell.documents` / `shell.files` | Capacidades v2 (ver plan). |

### Reglas de oro

- **React del host:** usa `globalThis.React`; nunca incluyas tu propia copia.
- **Sin JSX / sin build en el host:** escribe `React.createElement` (o trae tu
  propio `dist/` ya compilado; el host sirve el archivo tal cual).
- **Estado por instancia:** declara el estado **dentro** de `mount()` (closure),
  no en el módulo, para no compartirlo entre ventanas.
- **`h-full` y `overflow`:** tu raíz debe ocupar `100%` y no desbordar.
- **CSS con scope:** prefija todo con una clase raíz (`.kimos-miapp …`) para no
  filtrar estilos al shell.

---

## 4. Persistencia (qué usar)

| Necesitas… | Usa | Dónde vive hoy |
|------------|-----|----------------|
| Un documento JSON (estado completo) | `saveData({ ... })` / `loadData()` | blob GCS por instancia |
| Listas/colecciones (tarjetas, filas) | `shell.items` CRUD | subcolección Firestore de la instancia |
| Parámetros de la app | `defaultConfig` + 🔭 `shell.config` | `config` de la instancia |

Patrón recomendado (FossFLOW/Kanban): **un objeto modelo** en el closure,
`loadData()` al montar, y `saveData()` con *debounce* tras cada mutación. UI del
usuario y agente mutan el **mismo** estado → repintado reactivo.

---

## 5. Reactividad (usuario + agente sobre el mismo estado)

```js
let model = initialModel();
const listeners = new Set();
function commit(next){ model = next; listeners.forEach(l => l(model)); scheduleSave(); }
// El Component se suscribe (listeners.add(setState)); el agente llama a las
// mismas funciones que la UI → el lienzo se repinta solo cuando el agente actúa.
```

---

## 6. Control por agente (`agent.control`)

```js
shell.agent.register({
  label: 'Mi App',
  description: 'Qué puede hacer el agente.',
  tools: [
    { name: 'ADD_ITEM', description: '…',
      inputSchema: { type:'object', properties:{ text:{type:'string'} }, required:['text'] } },
  ],
  getSnapshot: () => ({ /* estado legible para el agente */ }),
  dispatchAction: async (action) => {
    // action = { app, type, payload }
    // retorna { success, message?, error? }
  },
});
```

- Declara `permissions: ["agent.control"]`.
- `getSnapshot()` debe devolver IDs y datos suficientes para que el agente sepa
  sobre qué actuar **antes** de despachar.
- Valida y normaliza **todo** input del agente (puede mandar datos fuera de rango).
- El host fuerza el `app` de la acción al `bridgeId` real (no puedes actuar en
  nombre de otra app).

---

## 7. Empaquetado e instalación

**A. Vía repo oficial (actual):**
1. Crea `apps/{id}/` + entrada en el `manifest.json` raíz.
2. Mergea a `kimos-packages/main`.
3. La Tienda instala (descarga `dist/index.js`/`index.css` y los sirve).
4. Un **bump de `version`** propaga cambios (reinstala).

**B. Vía comprimido `.kapp` (sideload):**
- Un ZIP con `manifest.json` + `dist/` (+ `assets/`) en la raíz. Genéralo con el
  empaquetador (valida id/version/permissions/entry y comprime sin dependencias):

  ```bash
  node tools/pack.mjs apps/mi-app        # → mi-app-1.0.0.kapp
  ```

- En la Tienda (superadmin) → **"Instalar desde archivo"** y elige el `.kapp`.
- Permite apps **privadas** sin publicarlas al repo oficial. Para apps de terceros,
  recuerda que el bundle se ejecuta en la página: instala solo apps de confianza.
- Usa un `id` con **namespace** (`miorg.mi-app`) para no chocar con apps oficiales.

**Assets de la app** (`assets/`): los archivos bajo `assets/` se sirven en
`/api/apps/{id}/asset/{ruta}`. Desde el bundle usa `shell.assetUrl('icons/x.svg')`
para obtener su URL — alternativa a embeber recursos. (Vía repo oficial, el
backend solo sirve `dist/`; para assets nativos por esa vía, empaqueta `.kapp` o
embébelos en el bundle, como hace FossFLOW con sus SVG.)

---

## 8. Checklist antes de publicar

- [ ] `manifest.json` (app + entrada en el raíz) con `version` correcta.
- [ ] `dist/index.js` exporta `default mount(shell)` y usa `globalThis.React`.
- [ ] Estado dentro del closure; `unmount()` limpia timers/listeners/agente.
- [ ] CSS con clase raíz; la app respeta `height:100%` sin desbordar.
- [ ] Persistencia probada (`multiInstance` si guardas datos).
- [ ] Si hay agente: `getSnapshot` útil + validación de inputs + dedupe.
- [ ] Carga sin red en runtime (recursos embebidos o por URL explícita del usuario).
- [ ] Verificación: `node --input-type=module -e "import('./apps/{id}/dist/index.js')…"`.

---

## 9. Ejemplos en este repo

- **`apps/kanban`** — `saveData/loadData`, drag&drop nativo, sin agente.
- **`apps/notas-equipo`** — `shell.items` + agente (multiInstance de ejemplo).
- **`apps/fossflow`** — modelo JSON complejo, render SVG isométrico, iconos
  nativos embebidos, agente con muchas tools, área de trabajo en cuadrícula.
