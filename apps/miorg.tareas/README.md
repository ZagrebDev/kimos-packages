# ✅ Tareas del Equipo — app de EJEMPLO de terceros (superficie completa)

El ejemplo de referencia para apps **con datos y agente IA**: cubre toda la
superficie del AppShell que `miorg.encuestas` y `miorg.buzon` (centrados en el
gateway público) no demuestran. Escrita sin minificar y comentada — pensada
para copiarla como punto de partida (o generar el esqueleto equivalente con
`node tools/create-app.mjs`).

## Qué demuestra

| Capacidad | Dónde |
|---|---|
| Persistencia por documento (`shell.saveData`/`loadData` con debounce) | `scheduleSave()`, `load()` |
| Parámetros ⚙️ Configurar (`configSchema` + `shell.config.get/onChange`) | `initConfig()` — `showDone`, `accent`, `maxTasks` |
| Versiones 🗂️ Documentos (`shell.documents.onSerialize/onLoad`) | `initDocuments()` |
| Agente IA (`shell.agent.register`, permiso `agent.control`) | `initAgent()` — `ADD_TASK`, `COMPLETE_TASK`, `REMOVE_TASK`; snapshot con IDs y `version` |
| Datos de otra app (`shell.data`, permiso `data.read:miorg.encuestas`) | `loadEncuestas()` — pestaña Encuestas, con degradación si no hay acceso |
| Versión a la vista (`APP_VERSION` en cabecera y snapshot) | regla §7.a de `APP-SPEC.md` |
| Sistema visual de KIMOS (tokens del tema, fondo transparente + vidrio) | `dist/index.css` (§9 de `APP-SPEC.md`) |

Patrón central: **un objeto modelo en el closure** — la UI y el agente mutan el
estado por las MISMAS funciones (`addTask`/`setDone`/`removeTask`), así el
lienzo se repinta solo cuando el agente actúa y todo pasa por el mismo
`commit()` → `saveData()` con debounce.

## Uso

1. Empaquetar: `node tools/pack.mjs apps/miorg.tareas`
2. Instalar el `.kapp` (Tienda → Instalar desde archivo, superadmin). El
   instalador mostrará los permisos, incluido `data.read:miorg.encuestas`.
3. Crear un documento (cada uno es una lista distinta), añadir tareas, probar
   ⚙️ Configurar y 🗂️ Guardar versión / Historial.
4. Pedirle al agente IA: «añade la tarea comprar café» o «marca como hecha la
   primera tarea».
5. Si `miorg.encuestas` está instalada, la pestaña **Encuestas** lista sus
   instancias con el conteo de respuestas (lectura entre apps con RBAC).

## Versionado

Versión actual: **1.0.0**

| Versión | Qué trae |
|---|---|
| 1.0.0 | Versión inicial del ejemplo de superficie completa. |
