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

### 5.1 Colaboración multiusuario (varias personas a la vez)

No hay push del servidor: el patrón de la casa es **sincronizar cada pocos
segundos** cuando la ventana se ve (`contact-forms`, `productlab`,
`miorg.buzon`, `miorg.encuestas` y `web-agents` lo hacen así):

```js
const t = setInterval(() => {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refresh();
}, 30000);
```

Eso basta para apps de lectura (bandejas, listados). Si **dos personas editan
el mismo documento**, hace falta además no perder datos. La app `gantt` (v4)
implementa el patrón completo y es la referencia a copiar:

1. **Fusionar, no reemplazar.** `refresh()` no pisa el modelo con lo remoto:
   lo fusiona. Cada sub-entidad editable (tarea, tarjeta, fila) lleva su
   `updatedAt` y gana la más reciente **por entidad**, no por documento. Así
   dos personas que tocan filas distintas no se pisan.
2. **Lápidas para las bajas.** Guarda `deletedIds: [{id, at}]` en el documento
   y descarta al fusionar todo id con lápida más nueva que su `updatedAt`. Sin
   esto, lo que borra una persona reaparece desde la pantalla de la otra.
3. **Leer-fusionar-escribir.** Antes de cada `PUT`, relee del servidor, fusiona
   y recién ahí escribe. El `PUT` de un item hace merge de campos de primer
   nivel, así que un array (`tasks`, `cards`…) se reemplaza entero: la fusión
   tiene que ocurrir en el cliente.
4. **Auto-reparación.** Queda una ventana mínima (el viaje de red entre el read
   y el write) donde otra escritura puede quedar pisada. Cada sesión repara lo
   suyo: si al sincronizar falta algo **propio y reciente** que nadie borró, se
   vuelve a guardar solo. Acótalo a lo propio y reciente — si no, resucitarás lo
   que borró otra persona.
5. **No repintar de más.** Compara una firma del estado visible y emite solo si
   cambió: repintar cada pocos segundos molesta a quien está escribiendo.
6. **Cadencia según el foco.** Rápido con la ventana enfocada, lento de fondo,
   en pausa si la pestaña no se ve. Y serializa la red mutante en una cadena de
   promesas para no cruzar un guardado con un refresh.

Nada de esto necesita backend a medida ni cambia el modelo de datos: son campos
añadidos al documento que ya guardas. **No mandes campos de control en el body
del `PUT`** (`_loQueSea`): el backend los persistiría como parte del item.

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

> Desde jul-2026 el install por registry también **persiste los `permissions`**
> del manifest raíz (backend kimos-enterprice), así las apps oficiales pueden
> usar `public.read` / `data.read:*` sin sideload (ej: `productlab`). Los
> `assets/` siguen siendo solo-sideload por esta vía.

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

## 7.a Versionado: dónde vive la versión (y por qué falla la actualización)

La Tienda decide si hay actualización comparando la versión **instalada** con la
del **catálogo raíz** (`/manifest.json` → `apps[]`). Ese es el número que manda:
si se sube la versión dentro de `apps/{id}/` pero no en el catálogo, la app
instalada se queda con el bundle viejo y **no aparece nada que actualizar**
(pasó con `notas-equipo` 2.1.0 → la tarjeta seguía mostrando v2.0.0).

Al publicar un cambio, la versión sube en **los cuatro lugares, en el mismo commit**:

| # | Dónde | Para qué sirve |
|---|---|---|
| 1 | `apps/{id}/manifest.json` → `version` | Fuente de verdad de la app; es lo que valida `tools/pack.mjs` y lo que viaja en el `.kapp`. |
| 2 | **`/manifest.json` raíz** → `apps[] → {id}.version` | **Lo que lee la Tienda**: sin esto no se ofrece la actualización. Sube también la `description` si cambió. |
| 3 | `apps/{id}/dist/index.js` → `const APP_VERSION` | La versión que la app **muestra en pantalla** (ver abajo). |
| 4 | `apps/{id}/README.md` → “Versión actual” + tabla de historial | Documenta qué trae cada versión. |

**Verifícalo antes de commitear** (falla con código 1 si algo quedó desalineado):

```bash
node tools/check-versions.mjs                # todas las apps
node tools/check-versions.mjs notas-equipo   # una sola
```

**Criterio del número** (semver): parche `x.y.Z` para arreglos, menor `x.Y.0`
para funciones nuevas compatibles, mayor `X.0.0` si cambia el formato de los
datos guardados o el contrato del agente. Nunca reutilices un número ya
publicado: el backend guarda el bundle en `/apps/{id}/{version}/` y lo cachea,
así que repetir versión sirve bundles viejos.

### La versión, siempre a la vista

Toda app debe **identificar en pantalla el build que está corriendo**: sin eso no
hay forma de saber, al probar, si el host tomó la actualización o quedó con la
copia cacheada. La convención:

```js
// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '2.2.0';
…
h('span', { className: 'nt-ver', title: 'Notas de Equipo v' + APP_VERSION }, 'v' + APP_VERSION),
```

- Un chip discreto en la cabecera, junto al título (ver `apps/notas-equipo`).
- Si la app tiene pantalla de bienvenida o vacía, repítelo ahí.
- Si registra agente, incluye `version: APP_VERSION` en `getSnapshot()`, así el
  agente IA puede responder qué build está corriendo.

---

## 7.b Endpoints públicos para tu app (sin backend a medida)

Si tu app necesita recibir datos desde **sitios web externos** (formularios,
encuestas, webhooks simples), NO necesitas escribir un módulo backend: existe
un **gateway público genérico** gobernado por los `permissions` de tu manifest
(el superadmin los ve y aprueba al instalar tu `.kapp`):

| Permission | Endpoint público | Qué hace |
|---|---|---|
| `public.read` | `GET /api/public/app/{instanceId}/definition` | Devuelve **solo** `items/definition.public.data` (tú decides qué publicar). |
| `public.submit` | `POST /api/public/app/{instanceId}/submit/{canal}` | Guarda el envío como item (`kind: "submission"`, `channel: <canal>`) que gestionas con `shell.items`. |

**Opt-in por instancia** — tu bundle debe guardar en el item `definition`:

```jsonc
"public": {
  "enabled": true,                 // sin esto, el gateway responde 403
  "channels": ["contact"],         // canales de submit permitidos
  "data": { "title": "…", "fields": [ … ] }   // lo que expone /definition
}
```

**Guardarraíles de plataforma** (siempre activos, no configurables):
rate-limit por IP+instancia, honeypot `_hp`, payload ≤ 32 KB, ≤ 30 campos,
valores saneados a string plano (sin objetos anidados), y metadatos de
origen (`origin`, `userAgent`, `ip`) en cada envío.

**Patrón completo**: sirve tu propio `embed.js` como asset
(`assets/embed.js` → `/api/apps/{appId}/asset/embed.js`, ya público), que lea
`/definition` y postee a `/submit/{canal}`. Ejemplo real de referencia (con
backend propio, para apps oficiales curadas): `contact-forms` y `web-agents`.

> Validación fina (tipos de campo, email de aviso, widgets server-rendered)
> sigue siendo territorio de apps oficiales con módulo backend propio; el
> gateway cubre el caso general de terceros de forma segura.

---

## 7.c Leer datos de OTRAS apps (`shell.data`)

Tu app puede leer datos de otras apps (oficiales o de terceros) declarando el
permiso en su manifest — el superadmin lo ve y aprueba al instalar:

```jsonc
"permissions": ["instance.read", "instance.write", "data.read:contact-forms"]
```

En el bundle:

```js
if (shell.data) {
  const forms = await shell.data.listInstances('contact-forms');  // instancias visibles
  const items = await shell.data.listItems(forms[0].id);          // sus items
}
```

Reglas:
- `data.read:{templateId}` por cada template que leas (o `data.read:*` — pide
  solo lo que necesites: el instalador lo verá).
- El **RBAC del usuario es siempre el techo**: solo ves instancias de equipos
  a los que el usuario ya tiene acceso. El permiso de la app nunca lo supera.
- Solo lectura (los denegados quedan auditados). Escritura y suscripción a
  cambios: evoluciones futuras del contrato.

---

## 8. Checklist antes de publicar

- [ ] **Versión subida en los cuatro lugares** (§7.a) y `node tools/check-versions.mjs` en verde.
- [ ] La app **muestra su versión** en pantalla (`APP_VERSION` en la cabecera).
- [ ] `manifest.json` (app + entrada en el raíz) con `version` correcta.
- [ ] `dist/index.js` exporta `default mount(shell)` y usa `globalThis.React`.
- [ ] Estado dentro del closure; `unmount()` limpia timers/listeners/agente.
- [ ] CSS con clase raíz; la app respeta `height:100%` sin desbordar.
- [ ] Persistencia probada (`multiInstance` si guardas datos).
- [ ] Si hay agente: `getSnapshot` útil + validación de inputs + dedupe.
- [ ] Carga sin red en runtime (recursos embebidos o por URL explícita del usuario).
- [ ] Verificación: `node --input-type=module -e "import('./apps/{id}/dist/index.js')…"`.

---

## 9. Aspecto: el sistema visual de las apps de KIMOS

El referente es **`apps/productlab`**; `gantt` y `notas-equipo` ya están
alineadas. Copia su hoja de estilos como plantilla. Reglas:

1. **Ni un color propio cableado.** Todo sale de los tokens del tema del host
   (shadcn/HSL): `--background`, `--foreground`, `--card`, `--muted`,
   `--muted-foreground`, `--border`, `--input`, `--primary`,
   `--primary-foreground`, `--destructive`, `--radius`, `--shadow-sm/md`.
   Declara tus variables encima de ellos, con *fallback* al tema claro:

   ```css
   .kimos-miapp {
     --x-fg: hsl(var(--foreground, 220 25% 6%));
     --x-glass: hsl(var(--card, 0 0% 100%) / .6);
     --x-soft: hsl(var(--border, 214.3 18% 72%) / .4);
   }
   ```

   Así la app cambia de **día/noche** y de **color de acento** junto con KIMOS,
   sin escuchar nada. El modo noche sale gratis; solo se retocan los colores
   semánticos que quedan ilegibles sobre fondo oscuro:
   `.dark .kimos-miapp { --x-err: #F87171; }`.
2. **Fondo transparente + vidrio.** La raíz no pinta fondo (`background:
   transparent`): debajo está el fondo de pantalla del escritorio. Las
   superficies son `var(--x-glass)` + `backdrop-filter: blur(10px)` + borde
   suave + `--shadow-sm`, como el taskbar y el chat.
3. **Layout**: barra superior con *título · pestañas · acciones*
   (`grid-template-columns: 1fr auto 1fr`); las pestañas son la `TabsList` de
   shadcn (lista `muted`, pastilla activa con `background` + sombra).
4. **Tipografía** Inter, `--radius` del tema para las esquinas, y botones al
   estilo shadcn (outline por defecto, `--primary` para la acción principal).
5. **Angosto**: a `max-width: 860px` el header pasa a dos filas y las pestañas
   ocupan el ancho completo con scroll horizontal.

---

## 10. Ejemplos en este repo

- **`apps/kanban`** — `saveData/loadData`, drag&drop nativo, sin agente.
- **`apps/notas-equipo`** — `shell.items` + agente, edición en la propia tarjeta,
  redactor con formato (marcas tipo markdown pintadas como elementos React) y
  menú de `@menciones` sobre el textarea (personas y agentes IA de la
  organización).
- **`apps/gantt`** — colaboración multiusuario (§5.1), tabla con orden y filtros,
  agente con paridad total sobre la UI.
- **`apps/fossflow`** — modelo JSON complejo, render SVG isométrico, iconos
  nativos embebidos, agente con muchas tools, área de trabajo en cuadrícula.
- **`apps/productlab`** — referente de diseño (§9).
