# Crea tu app para KIMOS

Guía **pública** para construir apps instalables en KIMOS — pensada para que
cualquier persona (con la ayuda de su asistente de código favorito) pueda crear
una herramienta propia que funcione dentro de la plataforma, con datos
persistentes, agentes IA y hasta endpoints públicos, **sin escribir backend**.

> ¿Buscas la referencia técnica completa del contrato? Está en `APP-SPEC.md`.
> Este documento es el camino guiado: de cero a una app instalada.

---

> **¿Ya tienes una app hecha?** Esta guía es para escribir una desde cero. Si
> lo que traes es un `.kapp` que ya funciona y toca entrarlo al repositorio
> oficial, empieza por **`ALINEA-TU-APP.md`** y por
> `node tools/check-app.mjs apps/tu-app`.

## 1. Qué es una app de KIMOS

Una app de KIMOS es un **único archivo JavaScript** (bundle ESM) más un
`manifest.json`. Se instala desde la Tienda de la plataforma (o por archivo
`.kapp`) y se ejecuta en una ventana del escritorio KIMOS. La plataforma le da a
tu app, ya resueltos:

- **Ventanas** — tu app vive en una ventana con minimizar/maximizar/cerrar.
- **Documentos** — cada "documento" del usuario es una **instancia** de tu app,
  con menú Nuevo/Abrir/Guardar/Historial sin que escribas nada.
- **Persistencia** — guarda y lee datos con dos llamadas (`saveData`/`loadData`)
  o un CRUD de items; la plataforma se encarga del almacenamiento, los permisos
  y los equipos.
- **Agentes IA** — declara herramientas y el agente de la empresa podrá operar
  tu app conversando con el usuario.
- **Endpoints públicos** — recibe formularios o encuestas desde cualquier web
  externa a través del gateway público de la plataforma.
- **Datos de otras apps** — lee (con permiso) instancias e items de otras apps.

Tu app **no necesita servidor propio, ni base de datos, ni despliegue**: todo lo
anterior lo provee la plataforma a través del objeto `shell` que recibe tu
función `mount`.

---

## 2. Quickstart — tu primera app en 10 minutos

### 2.1 Estructura mínima

```
mi-app/
├─ manifest.json
└─ dist/
   ├─ index.js     ← el bundle (export default mount)
   └─ index.css    ← opcional
```

### 2.2 `manifest.json`

```jsonc
{
  "id": "miorg.mi-app",          // usa un namespace propio (tuorg.nombre)
  "name": "Mi App",
  "version": "1.0.0",
  "description": "Qué hace mi app.",
  "icon": "🧩",
  "author": "Tu nombre",
  "entry": "dist/index.js",
  "css": "dist/index.css",
  "appShellApi": "1.x",
  "multiInstance": true,          // true si tu app guarda datos
  "permissions": ["instance.read", "instance.write"]
}
```

**La versión, a la vista.** Declara el mismo número en el bundle y píntalo en la
cabecera de tu app: es la única forma de saber, al probar una actualización, si
KIMOS tomó el build nuevo o quedó con el cacheado.

```js
// Mantener en sincronía con manifest.json.
const APP_VERSION = '1.0.0';
…
h('span', { className: 'mi-ver' }, 'v' + APP_VERSION),
```

Cada vez que entregues un cambio, **sube el número en `manifest.json` y en
`APP_VERSION` a la vez** (SemVer: parche para arreglos, menor para funciones
nuevas, mayor si cambia el formato de tus datos). Nunca reutilices una versión
ya entregada: el host cachea el bundle por versión. Si tu app se publica en el
repositorio oficial, la versión sube **además** en el `manifest.json` raíz, que
es de donde la Tienda saca la actualización (ver `APP-SPEC.md` §7.a) — y
`node tools/check-versions.mjs` lo verifica por ti.

### 2.3 `dist/index.js`

```js
export default function mount(shell) {
  const React = globalThis.React;      // la plataforma expone React: NO lo empaquetes
  const h = React.createElement;       // sin JSX (no hay paso de build en el host)

  let model = { notas: [] };           // estado DENTRO de mount (una copia por ventana)
  const listeners = new Set();
  const commit = (next) => { model = next; listeners.forEach((l) => l(model)); save(); };

  let t;                               // guardar con debounce
  const save = () => { clearTimeout(t); t = setTimeout(() => shell.saveData(model), 600); };

  shell.loadData().then((data) => { if (data) commit({ ...model, ...data }); });

  function Component() {
    const [m, setM] = React.useState(model);
    React.useEffect(() => { listeners.add(setM); return () => listeners.delete(setM); }, []);
    return h('div', { className: 'miorg-miapp' },
      h('button', {
        onClick: () => commit({ notas: [...m.notas, `Nota ${m.notas.length + 1}`] }),
      }, 'Añadir nota'),
      m.notas.map((n, i) => h('p', { key: i }, n)),
    );
  }

  return { Component, unmount() { clearTimeout(t); } };
}
```

### 2.4 Empaquetar e instalar

```bash
node tools/pack.mjs mi-app        # valida el manifest y genera mi-app-1.0.0.kapp
```

En KIMOS: **Tienda → Instalar desde archivo** (requiere superadmin) → elige el
`.kapp`. El instalador muestra los `permissions` que pediste y los aprueba.
¡Listo! Tu app aparece en el lanzador.

Para actualizarla: sube `version` en el manifest, re-empaqueta y reinstala.

---

## 3. El objeto `shell` — tu única API

Todo lo que tu app puede hacer pasa por `shell`. Resumen:

| Miembro | Para qué |
|---------|----------|
| `shell.app` | `{ appId, instanceId, teamId }` — identidad de la ventana. |
| `shell.window.setTitle(t)` | Título de la ventana. |
| `shell.notify({ level, text })` | Toast (`info`/`success`/`warn`/`error`). |
| `shell.saveData(obj)` / `shell.loadData()` | Guardar/leer el documento de la instancia (un objeto JSON). |
| `shell.items.list/create/update/remove` | CRUD de una colección de items por instancia (filas, tarjetas, envíos…). |
| `shell.config.get()` / `.onChange(fn)` | Leer parámetros del formulario ⚙️ Configurar (ver §4). |
| `shell.documents.onSerialize/onLoad` | Integrarse con Guardar versión / Historial del menú 🗂️. |
| `shell.agent.register({...})` | Exponer herramientas al agente IA (ver §5). |
| `shell.assetUrl('ruta')` | URL pública de un archivo de tu carpeta `assets/`. |
| `shell.data.listInstances/listItems` | Leer datos de otras apps (ver §7.1). |
| `shell.data.create/update` | Escribir en otra app, si esa app publica su contrato (§7.2). |
| `shell.records` | Clientes, contactos y proyectos compartidos con el resto de KIMOS (§7.3). |
| `shell.files.upload/list/remove` | Subir archivos; la ruta la gestiona el host (§7.4). |
| `shell.brand.current()` | Marca del tenant: logos, razón social, colores (§7.5). |

**Reglas de oro** (las que rompen apps si se ignoran):

1. `globalThis.React` — nunca empaquetes tu propio React.
2. Estado **dentro** de `mount()` (closure), nunca a nivel de módulo.
3. CSS con una clase raíz propia (`.miorg-miapp …`) para no filtrar estilos.
4. Tu raíz ocupa `100%` de la ventana y no desborda.
5. `unmount()` limpia timers, listeners y registros de agente.
6. Si guardas datos → `multiInstance: true` en el manifest.

---

## 4. Parámetros configurables (⚙️) y documentos (🗂️)

Declara `configSchema` en el manifest y la plataforma genera el formulario de
configuración por ti:

```jsonc
"configSchema": {
  "title": "Preferencias",
  "fields": [
    { "key": "titulo", "label": "Título", "type": "string" },
    { "key": "color",  "label": "Color de acento", "type": "color" },
    { "key": "limite", "label": "Máximo de items", "type": "number", "min": 1, "max": 99 }
  ]
},
"defaultConfig": { "titulo": "Mi App", "color": "#19ACB1", "limite": 20 }
```

En el bundle: `const cfg = await shell.config.get()` y
`shell.config.onChange(aplicar)`.

Si tu app es `multiInstance`, el menú **🗂️ Documentos** (Nuevo, Abrir, Guardar,
Guardar versión, Historial, Renombrar, Eliminar) funciona solo. Para que
"Guardar versión"/"Restaurar" capturen tu estado:

```js
shell.documents.onSerialize(() => ({ model }));
shell.documents.onLoad((doc) => hidratar(doc.model));
```

---

## 5. Dale herramientas al agente IA

Con `permissions: ["agent.control"]`, el agente de la empresa puede operar tu
app en nombre del usuario:

```js
const off = shell.agent.register({
  label: 'Mi App',
  description: 'Gestiona notas del equipo.',
  tools: [
    { name: 'ADD_NOTE', description: 'Añade una nota.',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  ],
  getSnapshot: () => ({ notas: model.notas }),   // contexto que el agente "ve"
  dispatchAction: async ({ type, payload }) => {
    if (type === 'ADD_NOTE') {
      commit({ notas: [...model.notas, String(payload.text ?? '')] });
      return { success: true, message: 'Nota añadida.' };
    }
    return { success: false, error: `Acción desconocida: ${type}` };
  },
});
// en unmount(): off()
```

Consejos: `getSnapshot` debe incluir los IDs que el agente necesita para actuar;
valida **todo** input (el agente puede mandar datos fuera de rango); usa las
mismas funciones que tu UI para que la ventana se repinte sola.

---

## 6. Endpoints públicos sin backend (formularios, encuestas, buzones)

Si tu app debe recibir datos desde una **web externa**, pide estos permisos:

```jsonc
"permissions": ["instance.read", "instance.write", "public.read", "public.submit"]
```

y guarda en el item `definition` de cada instancia el bloque de publicación:

```jsonc
{
  "public": {
    "enabled": true,                      // sin esto, nada es público (opt-in)
    "channels": ["respuesta"],            // canales de envío permitidos
    "data": { "pregunta": "…", "opciones": ["A", "B"] }   // lo que expone /definition
  }
}
```

La plataforma expone entonces, para cada instancia:

| Endpoint | Qué hace |
|---|---|
| `GET /api/public/app/{instanceId}/definition` | Devuelve **solo** tu bloque `public.data`. |
| `POST /api/public/app/{instanceId}/submit/{canal}` | Guarda el envío como item (`kind: "submission"`) que lees con `shell.items`. |

La plataforma aplica siempre sus propios guardarraíles (límite de tamaño y de
frecuencia, saneamiento de valores, metadatos de origen) — tú no tienes que
implementar nada de eso.

**Patrón completo**: publica un `assets/embed.js` (se sirve público en
`/api/apps/{appId}/asset/embed.js`) que lea `/definition`, pinte el widget y
postee a `/submit/{canal}`. Quien quiera incrustar tu widget solo pega:

```html
<script src="https://SU-KIMOS/api/apps/miorg.mi-app/asset/embed.js"
        data-instance="ID-DE-LA-INSTANCIA" defer></script>
```

---

## 7. Conecta tu app con el resto de KIMOS

Tu app no vive sola. Hay tres cosas que **no deberías reinventar**: los datos
de otras apps, la identidad de los clientes y el almacenamiento de archivos.
Cada una se pide como permiso en el manifest, y el instalador lo ve y lo
aprueba.

### 7.1 Leer datos de otra app

```jsonc
"permissions": ["instance.read", "instance.write", "data.read:contact-forms"]
```

```js
const formularios = await shell.data.listInstances('contact-forms');
const mensajes    = await shell.data.listItems(formularios[0].id);
```

Un `data.read:{app}` por cada app que leas (`data.read:*` existe, pero pide
solo lo que necesites). **El acceso del usuario es siempre el techo**: tu app
solo ve instancias de equipos a los que el usuario ya pertenece.

### 7.2 Escribir en otra app

```jsonc
"permissions": ["data.write:customers"]
```

```js
const cliente = await shell.data.create(instanciaClientes, { name: 'Acme SpA', taxId: '77.718.188-2' });
await shell.data.update(instanciaClientes, cliente.id, { phone: '+56 9 1234 5678' });
```

Solo funciona si **la app dueña publica un `dataSchema`** diciendo qué acepta.
Si no lo publica, la escritura se rechaza: nadie escribe en una app que no ha
dicho qué admite. Solo pasan los campos declarados, y nunca objetos ni listas.

Para que **otras** apps puedan escribir en la tuya, declara tú el contrato:

```jsonc
"dataSchema": {
  "recordType": "account",
  "naturalKeys": ["taxId", "email"],
  "fields": [
    { "key": "name",  "label": "Razón social", "type": "string", "required": true },
    { "key": "taxId", "label": "RUT",          "type": "string" },
    { "key": "email", "label": "Correo",       "type": "email"  }
  ]
}
```

### 7.3 Clientes, contactos y proyectos compartidos (`shell.records`)

Si tu app maneja clientes, **no crees tu propia base de clientes**. Si lo
haces, el sistema acaba con un «Acme SpA» en Clientes, otro en Cotizaciones y
otro en Prospección, y ninguna vista completa del cliente.

La plataforma guarda solo la **identidad** (quién es); los **datos** siguen
siendo tuyos. Tú guardas la referencia más una instantánea de lo que pintas.

```jsonc
"permissions": ["records.link"]
```

```js
if (shell.records) {
  const { ref, created, record, warning } = await shell.records.findOrCreate('account', {
    keys:  { taxId: '77.718.188-2' },
    label: 'Acme SpA',
  });
  if (warning) shell.notify({ level: 'warn', text: warning });

  mi.recordRef = ref;                                  // la referencia
  mi.cliente   = { nombre: record.label };             // la instantánea

  await shell.records.link(ref, { instanceId, itemId: mi.id, kind: 'cotizacion' });
}
```

- `findOrCreate` **reutiliza** si ya existe: eso es lo que mantiene una sola
  base. Da igual si el RUT venía escrito `77.718.188-2` o `777181882`.
- `search({ type: 'account', q })` alimenta tu selector de cliente.
- `links(ref)` responde «dame todo lo de Acme», en todas las apps.
- Tipos: `account`, `contact`, `product`, `opportunity`, `project`. No hay
  «cliente» y «prospecto» aparte: la misma empresa puede ser las dos cosas, y
  el rol es un dato tuyo.

### 7.4 Archivos (`shell.files`)

Para fotos, logos o adjuntos. La **ruta la decide el host**; tú eliges la
carpeta lógica.

```jsonc
"permissions": ["files.write"]
```

```js
const url = await shell.files.upload(archivo, { folder: 'portadas', maxMB: 8 });
bloque.imagen = url;              // URL pública: sirve en <img src> y en un correo
await shell.files.remove(url);    // solo borra dentro del espacio de tu app
```

No subas ahí nada que no pueda ser público de lectura.

### 7.5 La marca del tenant (`shell.brand`)

No definas los colores ni el logo de la empresa dentro de tu app. Si respetas
la regla de los tokens del tema (nada de colores cableados), **el host inyecta
los colores de la marca activa y tu app se re-marca sola**: no hay nada que
programar.

Lo que sí puedes pedir son los **datos** de marca, para no obligar al usuario a
volver a escribir su razón social:

```jsonc
"permissions": ["brand.read"]
```

```js
if (shell.brand) {
  const marca = await shell.brand.current();   // null si el tenant no configuró ninguna
  if (marca) {
    cabecera.logo   = marca.logos.light || '';
    cabecera.emisor = marca.legalName || marca.name;
    cabecera.rut    = marca.taxId;
  }
}
```

Buen patrón: la marca **rellena**, el usuario **puede sobrescribir** para un
caso puntual. No la impongas.

### Compruébalo antes de usarlo

`shell.records`, `shell.files` y `shell.brand` pueden no existir en un host
anterior. Tu app no debe romperse por eso:

```js
if (!shell.records) { /* pide el cliente a mano y sigue funcionando */ }
```

Detalle completo: **APP-SPEC.md §7.c, §7.d, §7.e y §7.f**.

---

## 8. Tutorial guiado: `miorg.encuestas`

Este repo incluye dos apps de ejemplo escritas exactamente como las escribiría
un tercero — sin backend, solo manifest + bundle + embed:

- **`apps/miorg.encuestas`** — encuesta de una pregunta incrustable en cualquier
  web. Demuestra: `public.read`/`public.submit`, el bloque `public` en
  `definition`, el widget `assets/embed.js`, y la lectura de respuestas con
  `shell.items` (pestaña Resultados).
- **`apps/miorg.buzon`** — buzón de mensajes/sugerencias incrustable, con
  lectura de envíos y marcado de leídos. Además demuestra `shell.data` leyendo
  datos de otra app.

Recorrido sugerido: lee su `manifest.json` → `dist/index.js` (está escrito sin
minificar, con comentarios) → `assets/embed.js` → empaqueta con
`node tools/pack.mjs apps/miorg.encuestas` → instala el `.kapp` → crea una
encuesta → pega el snippet en una página HTML local → responde → mira la
pestaña Resultados.

---

## 9. Checklist antes de entregar

- [ ] `manifest.json` con `id` con namespace propio, `version` SemVer y solo los
      `permissions` que de verdad usas.
- [ ] La `version` es **nueva** (nunca una ya entregada), coincide con
      `APP_VERSION` del bundle y la app la **muestra en pantalla**.
- [ ] `dist/index.js` exporta `default mount(shell)`, usa `globalThis.React` y
      no importa dependencias externas en runtime.
- [ ] Estado en el closure; `unmount()` limpia todo.
- [ ] CSS con clase raíz; la app respeta `height:100%`.
- [ ] Persistencia probada (crear → cerrar ventana → reabrir → los datos están).
- [ ] Si hay agente: inputs validados y `getSnapshot` útil.
- [ ] Si hay endpoints públicos: `public.enabled` es opt-in por instancia y el
      widget funciona desde una página externa.
- [ ] Si manejas clientes: usas `shell.records` en vez de tu propia base, y tu
      app sigue funcionando si `shell.records` no existe.
- [ ] Si guardas archivos: `shell.files`, no un bucket propio ni base64 dentro
      del documento.
- [ ] Si tu app muestra logo, razón social o colores de la empresa: vienen de
      `shell.brand`, no de un formulario propio.
- [ ] `node tools/check-app.mjs <carpeta>` sin errores (los avisos, leídos:
      los que descartes, escríbelo en tu README y por qué).
- [ ] `node tools/pack.mjs <carpeta>` empaqueta sin errores.

## 10. Preguntas frecuentes

**¿Puedo usar TypeScript/JSX/mi framework?** Sí, compilando **tú** a un bundle
ESM plano (`dist/index.js`). La plataforma no compila nada: sirve tu archivo tal
cual. Lo único innegociable es usar el React del host (`globalThis.React`).

**¿Dónde se guardan mis datos?** En la infraestructura de la empresa donde se
instala la app, bajo sus permisos y equipos. Tu app no gestiona credenciales ni
almacenamiento.

**¿Mi app puede llamar a APIs externas?** El bundle corre en el navegador del
usuario: puede hacer `fetch` a servicios públicos con CORS habilitado. Para
recibir datos desde fuera, usa el gateway público (§6).

**¿Cómo publico en la Tienda oficial?** Las apps de la Tienda pasan por curación
del equipo de la plataforma. Mientras tanto, distribuye tu `.kapp` directamente:
cualquier superadmin puede instalarlo desde archivo.
