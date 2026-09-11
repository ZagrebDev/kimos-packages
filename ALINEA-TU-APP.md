# Alinea tu app con KIMOS

Guía para cuando **ya tienes una app hecha** —un `.kapp` que funciona— y toca
entrarla al repositorio oficial. No trata de cómo escribir una app (eso es
`CREA-TU-APP.md`), sino de las cuatro o cinco cosas que una app hecha aparte
suele resolver por su cuenta y que en KIMOS ya están resueltas para todos.

**Empieza por aquí:**

```bash
node tools/check-app.mjs apps/tu-app
```

El revisor separa dos cosas y la diferencia importa:

- **✖ error** — verificable. Impide empaquetar o hace que la app no funcione
  bien instalada. Hay que corregirlo.
- **! revisar** — una señal, no un veredicto. Se detecta leyendo tu bundle
  como texto, así que puede equivocarse. Nunca dice «está mal»: dice «esto
  parece X, compruébalo».

Lo que sigue es qué hacer con cada aviso.

---

## 1. «Parece guardar un RUT / una razón social por su cuenta»

**Por qué importa.** Si tu app se hace su propia ficha de cliente, el sistema
acaba con un «Acme SpA» en Clientes, otro en Cotizaciones y otro en el tuyo.
Tres Acmes, y ninguna vista completa del cliente. Nadie lo nota el primer mes;
se nota a los seis, cuando ya hay datos y arreglarlo es una migración.

**Qué hacer.** La plataforma guarda solo la **identidad** (quién es); los
**datos** siguen siendo tuyos. Tú guardas la referencia más una instantánea de
lo que pintas:

```jsonc
"permissions": ["records.link"]
```

```js
if (shell.records) {
  const { ref, created, record, warning } = await shell.records.findOrCreate('account', {
    keys:  { taxId: '77.718.188-2' },   // se normaliza: 77.718.188-2 == 777181882
    label: 'Acme SpA',
  });
  if (warning) shell.notify({ level: 'warn', text: warning });

  mi.recordRef = ref;                        // la referencia
  mi.cliente   = { nombre: record.label };   // la instantánea, que es lo que imprimes

  await shell.records.link(ref, { instanceId, itemId: mi.id, kind: 'oportunidad' });
}
```

**Guarda las dos cosas, no una.** La referencia es lo que permite cruzar apps;
la instantánea es lo que hace que un documento emitido hace ocho meses siga
mostrando lo mismo aunque el registro se renombre o desaparezca.

**Si tu app ES la dueña de esa ficha** (como Clientes lo es de `account`), no
hay nada que mover: declara `recordType` en tu `dataSchema` (§3 de esta guía) y
el revisor deja de señalarlo.

Tipos: `account`, `contact`, `product`, `opportunity`, `project`. No hay
«cliente» y «prospecto» aparte: la misma empresa puede ser las dos, y el rol es
un dato tuyo. Detalle: **APP-SPEC §7.d**.

---

## 2. «Sube archivos con `authFetch` a `/api/v2/files`»

**Por qué importa.** Funciona, pero la ruta la eliges tú, así que no hay
aislamiento por app, ni cuota atribuible, ni forma de limpiar al desinstalar.

**Qué hacer.** Deja que el host decida la ruta; tú eliges la carpeta lógica:

```jsonc
"permissions": ["files.write"]
```

```js
// antes
const fd = new FormData();
fd.append('path', 'imagenes/lo-que-se-me-ocurrio/' + file.name);
fd.append('file', file);
await shell.authFetch(API + '/api/v2/files', { method: 'POST', body: fd });

// después
const url = await shell.files.upload(file, { folder: 'portadas', maxMB: 8 });
```

La URL devuelta es **pública de lectura**: no subas ahí nada que no pueda
serlo. Detalle: **APP-SPEC §7.e**.

---

## 3. «¿Debería otra app poder alimentarla?»

**Por qué importa.** Sin `dataSchema` publicado, ninguna otra app puede
escribir en la tuya. Eso es lo correcto por defecto —falla cerrado—, pero si tu
app es un destino natural (un gestor de proyectos al que Cotizaciones debería
poder abrirle un proyecto cuando se acepta una propuesta), sin contrato ese
puente no existe.

**Antes de declararlo, una condición.** La pasarela escribe en los **items**
de una instancia (`shell.items`). Si tu app guarda su modelo entero en un solo
documento con `shell.saveData`, publicar un `dataSchema` sería prometer una
puerta que no existe: primero hay que mover a items lo que otras apps deban
poder alimentar. El revisor solo hace esta pregunta a las apps que ya usan
`shell.items`.

**Qué hacer.** Declara **qué aceptas**, campo por campo:

```jsonc
"dataSchema": {
  "recordType": "project",            // opcional: qué identidad representa (§7.d)
  "naturalKeys": ["code"],            // opcional: por qué se reconoce
  "fields": [
    { "key": "name",   "label": "Nombre",  "type": "string", "required": true },
    { "key": "code",   "label": "Código",  "type": "string" },
    { "key": "client", "label": "Cliente", "type": "string" }
  ]
}
```

Lo que no declares, no se puede escribir desde fuera. Nunca se aceptan objetos
ni listas —reemplazar un array desde fuera rompería tu fusión entre usuarios— y
los campos de la plataforma (`id`, `createdAt`, `recordRef`…) no se habilitan
aunque los declares. Detalle: **APP-SPEC §7.c**.

---

## 4. «El CSS tiene N colores hex fuera de un token con nombre»

**Por qué importa.** Es el aviso que más rinde arreglar, y por una razón que no
es estética: KIMOS inyecta los colores de la **marca del tenant** como tokens
del tema. Una app cuyos colores salen de esos tokens **se re-marca sola**, sin
tocar una línea. Una app con los colores cableados, no: se queda con los del
autor para siempre, y el logo del cliente al lado de la paleta de otro.

**Qué hacer.** Los colores salen de los tokens del host, con un fallback:

```css
/* antes */
.mi-app .boton { background: #00e5d0; color: #0b1020; }

/* después */
.mi-app {
  --mi-accent:    hsl(var(--primary, 178 96% 59%));
  --mi-accent-fg: hsl(var(--primary-foreground, 220 25% 10%));
}
.mi-app .boton { background: var(--mi-accent); color: var(--mi-accent-fg); }
```

Dos detalles que evitan el error típico:

- Los tokens son **tripletas sin `hsl()`**, para poder modular la opacidad:
  `hsl(var(--primary) / .12)`.
- El texto que va **encima** del acento sale de `--primary-foreground`, no de un
  blanco fijo. Si la marca del tenant es un amarillo, el blanco fijo no se lee.

Un hex detrás de un token con nombre (`--ok: #0B8A42`) **no** cuenta: es una
decisión semántica en un solo sitio, y el revisor no lo señala. Lo que señala
son los hex sueltos dentro de las reglas. Detalle: **APP-SPEC §9**.

---

## 5. «Parece definir un emisor / un logo propio»

Si tu app muestra el logo, la razón social o el RUT de la empresa, no los pidas
en un formulario propio: ya están definidos una vez para todo KIMOS.

```jsonc
"permissions": ["brand.read"]
```

```js
if (shell.brands) {
  const marca = await shell.brands.current();   // null si el tenant no configuró ninguna
  if (marca) {
    cabecera.logo   = marca.logoLight || marca.logoDark;
    cabecera.emisor = marca.legalName || marca.name;
  }
}
```

**La marca rellena, el usuario puede sobrescribir.** No la impongas: un tenant
con dos unidades de negocio necesita poder emitir con otra razón social.
Detalle: **APP-SPEC §7.f**.

---

## 6. «Usa `shell.records` sin comprobar que exista»

`shell.records`, `shell.files` y `shell.brands` son **opcionales en el
contrato**: un tenant que no haya actualizado el shell no los tiene. Tu app no
debe romperse por eso.

```js
if (!shell.records) { /* pide el cliente a mano y sigue funcionando */ }
```

Y «existe» no es «hay algo»: `brands.current()` devuelve `null` en un tenant sin
marca, y `records.resolve()` devuelve `resolved: false` para una identidad que
ya no está. En los dos casos tu app sigue — por eso guardas tu instantánea.

---

## 7. Cosas de trámite que también avisa

| Aviso | Qué hacer |
|---|---|
| El bundle no declara `APP_VERSION` | Declárala y **muéstrala en pantalla**. Sin eso, al probar no se sabe qué build tomó el host. |
| No aparece en el catálogo raíz | Añade la entrada en el `manifest.json` de la raíz: la Tienda ofrece la actualización según **ese** catálogo, no según tu carpeta (§7.a). |
| El README dice otra versión | La versión vive en cuatro sitios y tienen que coincidir (§7.a). |
| Escribe HTML con `innerHTML` | El texto que escribe una persona —o que llega del catálogo de otra app— se pinta como elementos, no como HTML. |
| El CSS no parece tener clase raíz | Prefija todo con `.mi-app …` o tus estilos se filtran al shell. |
| Declara un permiso que no usa | Quítalo. El instalador los lee, y pedir de más gasta la confianza que necesitas para lo que sí usas. |

---

## Cierre

```bash
node tools/check-app.mjs apps/tu-app     # sin errores
node tools/check-versions.mjs tu-app     # versión alineada en los cuatro sitios
node tools/pack.mjs apps/tu-app          # genera el .kapp
```

Los avisos que decidas **no** atender: déjalo escrito en el README de tu app y
por qué. Un aviso descartado con motivo es una decisión; uno descartado en
silencio es el que vuelve dentro de seis meses.
