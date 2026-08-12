# 🗒️ Notas de Equipo

**Versión actual: 2.2.0** — la app la muestra en su cabecera (`v2.2.0`, junto al
nombre del documento), así se sabe de un vistazo qué build quedó instalado al
probar. El número vive en tres lugares que deben ir siempre juntos:
`manifest.json` (`version`), la constante `APP_VERSION` de `dist/index.js` y
esta línea del README.

Bloc de notas del equipo, multi-instancia (cada documento es un bloc distinto).
Cada nota es un item de la instancia (`shell.items`), así que dos personas
escribiendo notas distintas no se pisan: el CRUD ya es por nota.

## Qué hace (v2.2)

- **Etiquetar escribiendo `@`**: al teclear `@` dentro del redactor se despliega
  la lista de la organización debajo del cursor y se filtra mientras se escribe
  (sin acentos y por cualquier parte del nombre). `↑ ↓` para moverse,
  `Enter` o `Tab` para etiquetar, `Esc` para cerrar; también se elige con el
  mouse. Al etiquetar queda el `@Nombre` en el texto **y** el chip de la nota.
  El botón `👥` sigue abriendo la lista completa en chips, para quien la prefiera.
- **Personas y agentes IA**: la lista junta a los actores del equipo
  (`/api/identity/actors`) con los **agentes IA** de la organización
  (`/api/identity/agents`), marcados con 🤖 tanto en el menú como en los chips y
  en el texto de la nota. Un agente IA se etiqueta igual que una persona.
- **Notas editables**: texto, responsable y destinatarios se cambian después de
  creadas, desde la propia nota (✎ Editar) o desde el agente.
- **Responsable** de la nota (quién se hace cargo) y **menciones** a las
  personas a las que va dirigida. Las menciones se marcan con chips y también
  se resaltan como `@Nombre` dentro del texto.
- **Texto y chips sincronizados**: quitar un chip borra su `@Nombre` del texto,
  y cualquier `@Nombre` escrito a mano (sin pasar por el menú) queda etiquetado
  al guardar, así que la pestaña *Para mí* nunca se pierde una nota.
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

Las notas, las personas y los agentes IA se pueden referenciar por **nombre**
(sin acentos y parcial); si algo no calza, el error trae los candidatos para que
el agente se corrija solo. Escribir `@Nombre` dentro del `text` también etiqueta,
sin necesidad de repetirlo en `mentions`.

## Diseño

Mismos tokens de tema que ProductLab (el referente visual de las apps de
KIMOS): fondo transparente, superficies de vidrio con blur, tipografía Inter y
la paleta del host. Cambia de día/noche y de color de acento junto con KIMOS,
sin nada propio cableado.

## Implementación

Bundle ESM puro (`dist/index.js` + `dist/index.css`) que usa `globalThis.React`
(expuesto por el host) y cumple el contrato `AppShellV1`
(`mount(shell) -> { Component, unmount }`). No requiere paso de build.

## Historial de versiones

| Versión | Qué trae |
|---|---|
| **2.2.0** | Versión instalada visible en la cabecera (`v2.2.0`), para confirmar qué build tomó el host al actualizar. |
| 2.1.0 | Etiquetar escribiendo `@` en el propio texto (menú con autocompletado), personas **y agentes IA** de la organización en la misma lista, chips y texto sincronizados. |
| 2.0.0 | Notas editables, responsable y menciones, redactor con formato, pestañas *Para mí* / *A mi cargo*, actualización en vivo. |
| 1.x | Bloc de notas simple por instancia, con agente. |

Al publicar un cambio hay que subir el número en `manifest.json` y en
`APP_VERSION` (`dist/index.js`) a la vez, y anotar aquí qué trae: el host cachea
el bundle por versión, y la cabecera es lo que se mira para confirmar que el
KIMOS de pruebas ya tomó el build nuevo.
