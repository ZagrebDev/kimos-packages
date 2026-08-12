# 🗒️ Notas de Equipo

Bloc de notas del equipo, multi-instancia (cada documento es un bloc distinto).
Cada nota es un item de la instancia (`shell.items`), así que dos personas
escribiendo notas distintas no se pisan: el CRUD ya es por nota.

## Qué hace (v2)

- **Notas editables**: texto, responsable y destinatarios se cambian después de
  creadas, desde la propia nota (✎ Editar) o desde el agente.
- **Responsable** de la nota (quién se hace cargo) y **menciones** a las
  personas a las que va dirigida. Las menciones se marcan con chips y también
  se resaltan como `@Nombre` dentro del texto.
- **Redactor de verdad**: área multilínea donde **Enter hace salto de línea**
  (se envía con el botón o con `Ctrl/⌘+Enter`) y barra de formato con
  **negrita**, *cursiva*, ~~tachado~~, `código`, viñetas, **numeración**, cita,
  título y enlaces. Los botones envuelven la selección o prefijan las líneas
  seleccionadas, como en cualquier editor.
- **Pestañas** *Todas* / *Para mí* (notas que me mencionan) / *A mi cargo*
  (notas de las que soy responsable), con su contador.
- **En vivo**: las notas del equipo se actualizan solas mientras la ventana se
  ve (y se pausa si la pestaña está oculta). La lista solo se repinta si algo
  cambió, para no molestar a quien está escribiendo.

### Cómo se guarda el formato

Texto plano con marcas tipo markdown (`**negrita**`, `- viñeta`, `1. paso`,
`> cita`, `## título`). Al leer, la app construye **elementos React**, nunca
`innerHTML`: una nota no puede inyectar marcado en la aplicación (el `<img
onerror=…>` de una nota se ve como texto, que es justo lo que debe pasar).
Como el formato es texto, el agente y las búsquedas siguen viendo la nota tal
cual está escrita.

## Agente IA

| Acción | Para qué |
|---|---|
| `ADD_NOTE` | Agrega una nota, con `responsible` y `mentions` opcionales |
| `UPDATE_NOTE` | Edita texto, responsable y/o menciones de una nota |
| `DELETE_NOTE` | Elimina una nota |
| `LIST_NOTES` | Lista las notas con su responsable y destinatarios |

Las notas y las personas se pueden referenciar por **nombre** (sin acentos y
parcial); si algo no calza, el error trae los candidatos para que el agente se
corrija solo.

## Diseño

Mismos tokens de tema que ProductLab (el referente visual de las apps de
KIMOS): fondo transparente, superficies de vidrio con blur, tipografía Inter y
la paleta del host. Cambia de día/noche y de color de acento junto con KIMOS,
sin nada propio cableado.

## Implementación

Bundle ESM puro (`dist/index.js` + `dist/index.css`) que usa `globalThis.React`
(expuesto por el host) y cumple el contrato `AppShellV1`
(`mount(shell) -> { Component, unmount }`). No requiere paso de build.
