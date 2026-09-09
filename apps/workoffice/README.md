# Kimos WorkOffice 🧰

Suite ofimática de KIMOS: **Documentos, Hojas de cálculo, Presentaciones, Notas
y Calendario** en una sola ventana del escritorio, guardadas en la plataforma y
manejables por el agente IA.

Versión actual: **1.0.0**

- **Código fuente y pruebas**: repositorio [`Kimos-workoffice`](https://github.com/bvaldes-arch/Kimos-workoffice).
  Aquí vive el paquete publicable (`manifest.json` + `dist/` + `docs/`); `dist/`
  es un artefacto generado, no se edita a mano.
- **Contrato**: AppShell **v1** (`appShellApi: "1.x"`), `multiInstance: true`.
  Las capacidades v2 —⚙️ Configurar, 🗂️ Documentos y `shell.data`— se consumen
  de forma retrocompatible: se comprueba que existan antes de usarlas, así que
  la app funciona igual en un host v1.

---

## Qué hace

Una instancia = un **espacio de trabajo**. Cada archivo es un item
(`shell.items`), de modo que dos personas editando archivos distintos nunca se
pisan y el explorador puede listar sin abrir nada.

| Módulo | Lo esencial |
|---|---|
| 🏠 **Inicio** | Recientes, favoritos, papelera y **búsqueda dentro del contenido** de todos los archivos |
| 📄 **Documentos** | Editor por bloques (títulos, listas, tareas, cita, código), formato con marcas, índice navegable, exportación a Markdown, impresión/PDF y **combinación de correspondencia con Clientes** |
| 📊 **Hojas de cálculo** | Grilla virtualizada, 56 funciones (112 nombres, en español e inglés), varias hojas por archivo, formatos (moneda, %, fecha), deshacer, CSV, y **datos de Productos / Clientes / Pedidos** |
| 🖼️ **Presentaciones** | Seis plantillas, notas del orador y **modo presentación** a pantalla completa con reloj |
| 🗒️ **Notas** | Tablero con colores, fijado y `#etiquetas`; pestaña de solo lectura con las **Notas de Equipo** |
| 📅 **Calendario** | Mes, semana y agenda; superpone las tareas de **Planificación** en solo lectura |

Transversal: autoguardado con el estado siempre a la vista, paleta de comandos
`Ctrl+K`, día y noche con el tema de KIMOS, y control total por agente IA.

## Atajos

| Atajo | Qué hace |
|---|---|
| `Ctrl+K` | Paleta: crear, buscar en todo el espacio, saltar a un módulo |
| `Ctrl+S` | Guardar ahora (igual se guarda solo) |
| `Ctrl+Z` / `Ctrl+Y` | Deshacer / rehacer en la hoja |
| `F2` o `Enter` | Editar la celda; escribir directo la reemplaza |
| `Ctrl+B` / `Ctrl+I` | Negrita / cursiva |
| `F5` | Presentar · `Esc` sale |

En las fórmulas el punto es decimal y `;` separa argumentos; la coma vale como
decimal entre dígitos (`2,5`). `=SUMA(A1:A9)` y `=SUM(A1:A9)` hacen lo mismo.

## Integración con el resto de KIMOS

Todo por `shell.data` (APP-SPEC §7.c) y **siempre en solo lectura**: WorkOffice
nunca escribe en otra app, para que no haya dos fuentes de verdad del mismo dato.

| Permiso | Para qué |
|---|---|
| `data.read:products` | Traer el catálogo a una hoja |
| `data.read:customers` | Traer contactos a una hoja y combinar correspondencia |
| `data.read:orders` | Traer pedidos a una hoja para informes |
| `data.read:gantt` | Ver las tareas de Planificación en el calendario |
| `data.read:notas-equipo` | Ver las notas del equipo junto a las personales |

El RBAC del usuario es siempre el techo, los permisos están acotados a apps
concretas (nunca `data.read:*`) y todo esto se puede apagar desde ⚙️ Configurar.

**Deslinde con las apps que se le parecen** (detalle en
[`docs/INTEGRACION-KIMOS.md`](docs/INTEGRACION-KIMOS.md)):

- **Notas de Equipo** es el *canal del equipo* (responsable, menciones); las
  notas de WorkOffice son la *libreta del espacio de trabajo*. WorkOffice las
  muestra en una pestaña de solo lectura y remite a esa app para escribir.
- **Planificación** gestiona el *trabajo* (tareas, dependencias, avance); el
  calendario de WorkOffice gestiona el *tiempo* y solo las muestra.

## Preferencias (⚙️ Configurar)

Módulo de inicio · autoguardado · interfaz compacta · primer día de la semana ·
moneda de las hojas · traer datos de otras apps de KIMOS.

## Agente IA

13 herramientas: `LIST_FILES`, `SEARCH`, `READ_FILE`, `CREATE_FILE`,
`RENAME_FILE`, `DELETE_FILE`, `OPEN_FILE`, `SHEET_SET`, `DOC_APPEND`,
`SLIDE_ADD`, `NOTE_ADD`, `EVENT_ADD`, `GO_TO`.

El agente usa exactamente las mismas funciones que la interfaz, valida todo lo
que recibe y **no tiene ninguna herramienta de borrado definitivo**:
`DELETE_FILE` solo mueve a la papelera.

## Documentación

- [`docs/INVESTIGACION-UX.md`](docs/INVESTIGACION-UX.md) — hallazgos, decisiones de diseño, lo descartado y qué medir
- [`docs/INTEGRACION-KIMOS.md`](docs/INTEGRACION-KIMOS.md) — integración y análisis de redundancia app por app
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — modelo de datos, módulos, guardado y sincronización
- [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) — reglas de seguridad y comprobaciones previas a publicar

## Historial

| Versión | Qué trae |
|---|---|
| **1.0.0** | Primera versión: los cinco módulos, motor de fórmulas propio (sin `eval`, con detección de ciclos), paleta de comandos, autoguardado con fusión por archivo, integración de solo lectura con Productos, Clientes, Pedidos, Planificación y Notas de Equipo, agente IA con 13 herramientas, y 127 pruebas automatizadas. |
