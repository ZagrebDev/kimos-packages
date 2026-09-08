# Gestor de Proyectos (Kimos Project Manager) 🧭

App instalable de KIMOS para **dirigir proyectos de punta a punta, separados por
cliente**: planificar, ejecutar, controlar y cerrar, con un tablero global de la
cartera en la portada y un tablero propio dentro de cada proyecto.

**Versión actual: 1.0.0**

---

## Qué resuelve

| Necesidad | Cómo la cubre |
|---|---|
| Ver la cartera completa de un vistazo | Portada con avance global ponderado, salud de cada proyecto, hitos de los próximos 60 días, alertas y actividad reciente. Todo se recalcula solo. |
| Separar el trabajo por cliente | Los proyectos cuelgan de un cliente. Cada cliente muestra su número de proyectos, su avance medio y sus alertas. |
| Planificar de verdad | Fases, tareas con responsable, fechas, peso y entregable, hitos y línea temporal con la marca de hoy y las ventanas bloqueadas. |
| Controlar el avance | Avance real **contra el esperado a hoy**: la desviación es el número que dice si el proyecto va bien, no la sensación. |
| Gestionar el riesgo | Matriz 5×5 de probabilidad × impacto, con severidad, mitigación, responsable y estado. |
| Trabajar con la documentación | Biblioteca de imágenes, videos, PDF, planos y planillas, alimentada desde el disco, desde una carpeta conectada, desde Google Drive o desde cualquier enlace. |
| Proponer el plan de trabajo | El **analista** lee esa documentación y arma fases, tareas fechadas, hitos, riesgos típicos y el checklist de lo que falta. |
| Dejar memoria del proyecto | Bitácora de decisiones, reuniones, problemas e hitos; consultas abiertas con el cliente; costeo por partidas. |

## Pestañas

**Cartera** — `Panel` · `Clientes` · `Proyectos`
**Dentro de un proyecto** — `Resumen` · `Plan` · `Riesgos` · `Documentos` · `Analista` · `Bitácora` · `Ficha`

## El analista

Lee los nombres y tipos de los documentos indexados, las carpetas conectadas, el
objetivo, el alcance y las etiquetas; deduce de qué tipo de trabajo se trata y
propone un plan completo. Es **determinista y explicable**: cada propuesta viene
con la evidencia que la produjo, y **nada se aplica hasta que la persona lo
aprueba** (añadir al plan actual o reemplazarlo).

Plantillas incluidas: licitación o propuesta formal, implementación en terreno,
desarrollo de software, estudio o consultoría, campaña comercial y proyecto
general en cinco fases. Las fechas evitan fines de semana y las **ventanas
bloqueadas** que declares en la ficha del proyecto (por ejemplo, un mes en que el
cliente no permite trabajos).

## Documentos y carpetas

Los archivos **no se copian al servidor**. La app indexa la ficha de cada uno
—nombre, tipo, tamaño, ruta y carpeta de origen— y guarda una miniatura de las
imágenes. Así la biblioteca sirve para trabajar sin convertir el documento de la
instancia en un depósito de binarios.

| Origen | Cómo |
|---|---|
| Archivos sueltos | Botón *Cargar archivos* o arrastrarlos sobre la zona de la pestaña Documentos. |
| Carpeta del disco (C:\ u otra) | *Conectar carpeta*. Con la File System Access API queda un enlace vivo re-sincronizable con *volver a leer*; sin ella, el navegador entrega el contenido una vez. |
| Google Drive, OneDrive, Dropbox o cualquier enlace | *Drive / nube*: se registra la fuente con su enlace y, si pegas el listado de archivos, cada línea se convierte en una ficha de documento. |

## Ecosistema KIMOS

Con el permiso `data.read:*` de cada template, la ficha del proyecto lista las
instancias visibles de **Planificación**, **Kanban** y **Cotizaciones** del mismo
espacio de trabajo y permite enlazarlas al proyecto, de modo que la cartera sepa
qué tablero, qué plan y qué cotización corresponden a cada trabajo.

## Primer proyecto incluido

Al abrirse por primera vez, la app se siembra con el cliente **Parque Arauco** y
su proyecto **Licitación Directorios Digitales PAK y PLC** (proceso
PA-128-2026-DCL), cargado desde el informe consolidado del proceso: 8 fases, 31
tareas, 9 hitos, 13 riesgos priorizados, 11 documentos del proceso, 15 partidas
de costeo, 10 consultas abiertas y la ventana bloqueada de diciembre en Kennedy.
Sirve de proyecto real y de ejemplo completo de lo que la app sabe llevar.

## Control por agente IA

`shell.agent.register` con paridad sobre la interfaz:

`CREATE_CLIENT` · `CREATE_PROJECT` · `UPDATE_PROJECT` · `ADD_TASK` ·
`UPDATE_TASK` · `ADD_MILESTONE` · `ADD_RISK` · `UPDATE_RISK` · `ADD_DOCUMENT` ·
`ADD_LOG` · `PROPOSE_PLAN` · `APPLY_PLAN` · `OPEN_VIEW`

`getSnapshot()` devuelve la cartera completa con métricas por proyecto, tareas,
riesgos y fuentes, para que el agente sepa sobre qué actuar antes de despachar.

## Datos y colaboración

- Un documento JSON por instancia vía `shell.saveData()` / `loadData()`, con
  guardado *debounced* y sincronización periódica.
- **Fusión por entidad** (§5.1 del `APP-SPEC.md`): cada cliente, proyecto, tarea,
  riesgo y documento lleva su `updatedAt` y gana la edición más reciente; las
  bajas viajan como lápidas para que lo borrado no reaparezca desde la pantalla
  de otra persona. Dos personas pueden trabajar a la vez sin pisarse.

## Preferencias (⚙️ Configurar)

Color de acento · moneda por defecto · días de anticipación para las alertas ·
tablas compactas · mostrar u ocultar las cifras de presupuesto.

## Aspecto

Toda la paleta de interfaz sale de los tokens del tema del host: la app cambia de
día/noche y de color de acento junto con KIMOS. Las únicas excepciones
documentadas son los colores de serie de los gráficos y los de estado, que usan
una paleta categórica validada (separación bajo daltonismo ΔE ≥ 8 y piso de
visión normal ΔE ≥ 15 en ambos modos), con su juego de pasos para fondo oscuro.

## Historial de versiones

| Versión | Qué trae |
|---|---|
| **1.0.0** | Primera publicación. Cartera por cliente; tablero global y por proyecto en vivo; plan con fases, tareas, hitos y línea temporal; matriz de riesgos 5×5; biblioteca de documentos con carpetas locales, Drive y enlaces; analista que propone planes de trabajo con seis plantillas; bitácora; costeo por partidas; consultas abiertas; ventanas bloqueadas; enlace con Planificación, Kanban y Cotizaciones; agente IA con 13 herramientas; colaboración multiusuario con fusión por entidad; proyecto semilla de Parque Arauco. |
