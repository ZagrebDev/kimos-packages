# Integración con la plataforma KIMOS y análisis de redundancia

Dos preguntas, respondidas app por app:

1. **¿Qué le aporta WorkOffice a cada app existente?**
2. **¿En qué se pisan, y qué se hizo para que no se pisen?**

La regla que gobierna todo el documento: **una sola fuente de verdad por dato**.
Cuando dos apps pueden gestionar lo mismo, una manda y la otra lee. WorkOffice
siempre elige leer.

---

## 1. Mapa del ecosistema (catálogo raíz de `kimos-packages`)

| App | Qué gestiona | Relación con WorkOffice |
|---|---|---|
| **Notas de Equipo** `notas-equipo` | Notas dirigidas a personas, con responsable, menciones y agente | ⚠️ **Solapamiento real** → resuelto en §2.1 |
| **Planificación** `gantt` | Planes, tareas con fechas, dependencias, avance | ⚠️ **Solapamiento parcial** → resuelto en §2.2 |
| **Kanban** `kanban` | Tarjetas por columnas | ✳️ Vecino, sin solapamiento → §2.3 |
| **Productos** `products` | Catálogo, precios, stock | ✅ Complemento: se importa a una hoja |
| **Clientes** `customers` | Contactos | ✅ Complemento: se importa a una hoja y alimenta la combinación de correspondencia |
| **Pedidos** `orders` | Pedidos y estados | ✅ Complemento: se importa a una hoja para informes |
| **ProductLab** `productlab` | Productos configurables, costos, publicación | ✅ Sin solapamiento; comparte el sistema visual |
| **Estudio de Mercado** `estudio-mercado` | Tablero de análisis competitivo | ✅ Sin solapamiento |
| **Formularios de Contacto** `contact-forms` · **Agentes Web** `web-agents` | Captación desde sitios externos | ✅ Sin solapamiento |
| **FossFLOW** `fossflow` | Diagramas isométricos | ✅ Sin solapamiento (WorkOffice no hace diagramas) |
| **Tarjetas Virtuales** `kimos.tarjetas` | Tarjetas de presentación | ✅ Sin solapamiento |
| **Archivos** (sistema) | Ficheros del escritorio | ✳️ Vecino → §2.4 |

---

## 2. Los solapamientos, uno por uno

### 2.1 Notas de Equipo — el caso más delicado

**Se parecen en**: ambas muestran notas de texto con formato.

**Se diferencian en el propósito, y esa es la línea de corte**:

| | Notas de Equipo | Notas de WorkOffice |
|---|---|---|
| Para qué | **Canal del equipo**: le escribo *a alguien* | **Libreta del espacio**: apunto *para el trabajo que tengo abierto* |
| Tiene | Responsable, menciones `@`, pestañas "Para mí" / "A mi cargo" | Color, fijado, `#etiquetas`, búsqueda junto al resto de los archivos |
| Vive junto a | Las demás notas del equipo | El documento, la hoja y la presentación del mismo espacio |

**Qué se hizo para no duplicar**:

- WorkOffice **no** copia, no sincroniza y no escribe notas del equipo.
- Muestra las notas de `notas-equipo` en una **pestaña aparte, en solo lectura**,
  con un aviso visible: *"Para escribir, responder o asignar una nota del equipo,
  abre esa app"* (`src/60-notes.js`).
- Si la app no está instalada o falta el permiso, la pestaña simplemente no
  aparece. No hay estado roto ni mensaje de error.

**Recomendación al equipo de producto**: si en el futuro se quisiera una sola
app de notas, la fusión correcta es al revés — llevar el modelo de responsable y
menciones de `notas-equipo` a WorkOffice y retirar la otra. Mientras las dos
existan, esta separación es la que evita dos bandejas para lo mismo.

### 2.2 Planificación (`gantt`)

**Se parecen en**: ambas tienen fechas.

**Se diferencian en**: Planificación gestiona el *trabajo* (tareas, dependencias,
avance, responsables). El Calendario de WorkOffice gestiona el *tiempo*
(reuniones, hitos, recordatorios).

**Qué se hizo**:

- El calendario **superpone** las tareas de Planificación con fecha, marcadas
  con `📊`, trama distinta y tooltip que dice de qué plan vienen y que son de
  solo lectura (`src/70-calendar.js`).
- WorkOffice **nunca escribe** una tarea de Planificación. Escribirla duplicaría
  la fuente de verdad y dejaría dos números distintos para el mismo trabajo.
- Una tarea de varios días aparece en cada día que ocupa, con tope defensivo de
  60 días por tarea y 500 tareas en total, para que un plan enorme no ahogue la
  vista.

### 2.3 Kanban

No se pisan: Kanban ordena trabajo por estado, WorkOffice produce documentos. No
se integró nada **a propósito** — traer tarjetas al calendario sin fechas reales
sería ruido. Si Kanban incorpora fechas de vencimiento, la integración natural es
la misma vía que `gantt` y son ~20 líneas.

### 2.4 App Archivos (sistema)

Archivos guarda **ficheros** (PDF, imágenes, adjuntos). WorkOffice guarda
**documentos vivos** que se editan dentro de la plataforma. La convivencia es
clara: lo que se recibe de fuera vive en Archivos; lo que se redacta dentro vive
en WorkOffice, y sale de ahí por exportación (CSV, Markdown, PDF).

---

## 3. Lo que WorkOffice sí trae de otras apps

Todo por `shell.data` (APP-SPEC §7.c), declarado en el manifest y aprobado por
el superadmin al instalar.

| Permiso | Para qué, exactamente | Dónde |
|---|---|---|
| `data.read:products` | Volcar el catálogo (SKU, nombre, precio, stock, categoría) a una hoja | Hojas → ⇄ → *Traer datos de KIMOS* |
| `data.read:customers` | Volcar contactos a una hoja **y** combinar correspondencia: un documento por cliente sustituyendo `{{nombre}}`, `{{correo}}`… | Hojas y Documentos → ⇄ → *Combinar con Clientes* |
| `data.read:orders` | Volcar pedidos (nº, cliente, total, estado, fecha) para informes | Hojas → ⇄ |
| `data.read:gantt` | Ver las tareas con fecha en el calendario | Calendario |
| `data.read:notas-equipo` | Ver las notas del equipo junto a las personales | Notas → pestaña *Del equipo* |

**Las tres reglas del puente** (`src/35-kimos-data.js`):

1. **El RBAC del usuario es el techo.** El permiso de la app nunca amplía lo que
   la persona ya puede ver. Si no tiene acceso al equipo, no llega nada.
2. **Solo lectura.** WorkOffice jamás escribe en otra app.
3. **Degradación limpia.** Sin permiso, sin host compatible, sin red o con la
   preferencia apagada, la función se apaga con un aviso claro; nunca rompe la
   app ni deja la pantalla a medias. La preferencia ⚙️ *"Traer datos de otras
   apps de KIMOS"* permite apagarlo por instancia.

Además, lo importado entra a la hoja como **texto**: un valor que empiece por
`=` se antepone con `'` para que un catálogo no pueda inyectar fórmulas que se
evalúen solas (ver [SEGURIDAD.md](SEGURIDAD.md)).

---

## 4. Compatibilidad con el contrato de la plataforma

| Punto de `APP-SPEC.md` | Cómo lo cumple WorkOffice |
|---|---|
| §2 `multiInstance` para persistir | `multiInstance: true`; una instancia = un espacio de trabajo |
| §3 React del host, sin JSX, estado en el closure | `globalThis.React`, `React.createElement`, todo el estado dentro de `mount()` |
| §3.1 ⚙️ Configurar | `configSchema` + `defaultConfig`; se lee con `shell.config.get/onChange` |
| §3.1 🗂️ Documentos y versiones | `shell.documents.onSerialize/onLoad`; restaurar **fusiona**, no borra lo actual |
| §4 Persistencia | `shell.items` (un archivo = un item), no un blob único |
| §5 Reactividad | Un modelo, un `emit()`; interfaz y agente mutan lo mismo |
| §5.1 Colaboración | Fusión por archivo con `updatedAt`, cadencia según foco, cola de red serializada, auto-reparación acotada de lo recién creado |
| §6 Agente | 13 herramientas, `getSnapshot` con IDs, validación de todo input, sin borrado definitivo |
| §7.a Versionado | La versión sube en los cuatro lugares; `APP_VERSION` se inyecta desde el manifest al compilar |
| §7.c `shell.data` | §3 de este documento |
| §9 Sistema visual | Ni un color cableado: todos los tokens del tema del host, fondo transparente, superficies de vidrio |

**Sobre `appShellApi`**: se declara `"1.x"` a propósito. Las capacidades v2
(⚙️ Configurar, 🗂️ Documentos, `shell.data`) se consumen de forma
**retrocompatible** — se comprueba que existan antes de usarlas — tal como
recomienda APP-SPEC §3.1 y como hace `productlab`. Declarar `"2.x"` haría que un
host v1 rechazara la app sin ganar nada.

---

## 5. Recomendaciones para la plataforma

Hallazgos que exceden a esta app y conviene que el equipo de KIMOS considere:

1. **Escritura vía `shell.data`.** Hoy es solo lectura. Con escritura consentida,
   "agendar la reunión de esta tarea" o "actualizar el precio desde la hoja"
   dejarían de ser copiar y pegar. Requiere un modelo de permisos de escritura
   por template.
2. **Notificación de cambios (push).** Sin canal del servidor, toda
   colaboración es sondeo. Un `shell.subscribe(instanceId)` permitiría edición
   concurrente fina en la misma hoja.
3. **Assets por la vía del repo oficial.** Hoy `assets/` solo llega por
   `.kapp` (APP-SPEC §7). WorkOffice no los necesita —todo va embebido—, pero
   limita a las apps que sí.
4. **Un tipo de dato "archivo" compartido.** Si varias apps van a producir
   documentos, valdría un contrato común para que Archivos los liste sin conocer
   cada app.
