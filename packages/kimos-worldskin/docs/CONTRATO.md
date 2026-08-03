# Contrato de adopción · KIMOS WorldSkin 1.0.0

Este documento es la parte seria del paquete. Define **qué app puede adoptarlo**,
**qué tiene que poner el anfitrión**, **qué garantiza el paquete** y **cómo se
verifica** que la adopción no ha roto nada.

Si una app no cumple el apartado 1, no debe adoptar WorldSkin. No es una
recomendación: el mundo se siembra desde el flujo de agentes, así que en una app
sin flujo el mapa saldría vacío y los avatares no representarían nada. Un
decorado que no dice la verdad es peor que no tener decorado.

---

## 0. Qué es esto y qué NO es

WorldSkin es un **paquete de fuentes versionado**, no una librería en tiempo de
ejecución.

Las apps de KIMOS son bundles ESM autónomos: el host las sirve tal cual y cada
una vive en su propio ámbito. **No existe un runtime compartido entre apps**, ni
un `window.KIMOS.worldskin` al que engancharse. Intentar inventarlo —cargar el
paquete por red, colgarlo de `globalThis`, compartir estado entre instancias—
sería precisamente el riesgo para el ecosistema que hay que evitar: acopla apps
que hoy no pueden romperse entre sí, y convierte el fallo de una en el fallo de
todas.

Así que adoptar WorldSkin significa una sola cosa: **copiar sus fragmentos de
`src/` al build de tu app**. Nada en caliente, nada compartido en memoria.

| | |
|---|---|
| Es | Fuentes que se compilan dentro de tu bundle |
| No es | Un paquete npm, un import remoto, un runtime, un servicio |
| Actualizar | Volver a copiar/vendorizar y rehacer el build |
| Aislamiento | Total: dos apps con WorldSkin no se ven ni se afectan |

---

## 1. Criterios de compatibilidad

Una app de KIMOS **puede** adoptar WorldSkin si cumple **todos** estos puntos.

### 1.1 Obligatorios

1. **Tiene flujo de trabajo.** Existe una lista ordenada de etapas con
   dependencias declaradas, y una función que devuelve ese flujo con su estado
   actual (equivalente a `workflowPlan(model) → [{ id, name, emoji, status, … }]`).
2. **Tiene agentes.** Cada nodo del flujo es un agente con identidad estable
   (`id`), nombre y descripción; y el usuario puede ejecutarlos, activarlos y
   desactivarlos. Sin esto, los avatares no tendrían estado que representar.
3. **Los estados del flujo se pueden traducir** a este vocabulario:
   `running` · `done` · `error`/`blocked` · `off`/`skipped` · `idle`.
   La traducción la hace el anfitrión en la función `statusOf(agentId)`.
4. **Renderiza con `globalThis.React` sin JSX**, con la forma `h(tag, props,
   children)`, tal y como exige `APP-SPEC.md`.
5. **Persiste su documento con `shell.saveData` / `loadData`** (o el mecanismo
   de documento de la app). El mundo se guarda ahí, en la instancia de la app
   anfitriona, y en ningún otro sitio.
6. **Su CSS está enclaustrado** bajo una clase raíz propia (`.kimos-<app>`). El
   CSS de WorldSkin se anida bajo esa misma raíz al vendorizarlo.

### 1.2 Descalificantes

No adoptes WorldSkin si tu app:

- **No tiene agentes ni flujo** (una calculadora, un visor, un formulario). El
  mundo no tendría a quién poner dentro.
- **Depende de que la pestaña esté siempre al frente** para no perder trabajo:
  el bucle de animación se pausa cuando la pestaña se oculta, y eso es
  deliberado.
- **Ya define símbolos `ws*` / `WS_*`** propios. El prefijo es la única defensa
  contra colisiones en un ámbito compartido; si chocan, renombra los tuyos o no
  adoptes.
- **Necesita más de ~200 avatares** en pantalla a la vez. Está acotado a
  propósito (`WS_STAFF_MAX`); por encima de eso el navegador del usuario paga la
  fiesta.

---

## 2. Lo que tiene que poner el anfitrión

WorldSkin no importa nada. Los fragmentos que viven **dentro de `mount()`**
(prefijo `5x`) usan cinco símbolos que ya existen en cualquier app de KIMOS:

| Símbolo | De dónde sale | Uso |
|---|---|---|
| `h` | `globalThis.React.createElement` | Construir el SVG y la UI |
| `useState` | `globalThis.React.useState` | Repintado del bucle |
| `useEffect` | `globalThis.React.useEffect` | Alta/baja del `requestAnimationFrame` |
| `useRef` | `globalThis.React.useRef` | Estado de simulación entre fotogramas |
| `cx` | La app (`(...xs) => xs.filter(Boolean).join(' ')`) | Componer clases |

Si tu app no tiene `cx`, son tres líneas. No hay más dependencias: los
fragmentos de dominio (`17`, `19`, `21`) no tocan React, ni el DOM, ni la red.

Además, para que el mundo signifique algo, el anfitrión aporta:

```js
// 1. Traducir el estado real del flujo al vocabulario de WorldSkin.
const statusOf = (agentId) => (workflowPlan(model).find((n) => n.id === agentId) || {}).status;

// 2. Sembrar el mundo la primera vez, desde el propio flujo.
model.world = wsSeedWorld(workflowPlan(model), {
  appId: 'mi-app',
  groups: [{ departmentId: 'produccion', name: 'Producción', structure: 'factory' }, …],
});

// 3. Normalizar al cargar, como con el resto del documento.
out.world = wsMigrateWorld(d.world);
```

---

## 3. Cómo se vendoriza

Los fragmentos llevan **prefijo numérico** para poder intercalarse con los de la
app en el mismo orden de concatenación:

| Fragmento | Ámbito | Debe quedar… |
|---|---|---|
| `17-ws-core.js` | módulo | antes del modelo de la app (usa `emptyTheme`, `resolveTheme`) |
| `19-ws-world.js` | módulo | después de `17` |
| `21-ws-sim.js` | módulo | después de `19` |
| `53-ws-ui-world.js` | **dentro de `mount()`** | después de que existan `h`, `cx` y los helpers de UI |

Dos formas de adoptarlo, ambas válidas:

**A. Referenciar el paquete desde el build (recomendado en este repo).**

```js
const fragments = [
  ...fs.readdirSync(appSrc).map((f) => ({ n: f, p: path.join(appSrc, f) })),
  ...fs.readdirSync(pkgSrc).map((f) => ({ n: f, p: path.join(pkgSrc, f) })),
].sort((a, b) => a.n.localeCompare(b.n));
```

Ventaja: una sola copia en el repo, y actualizar el paquete actualiza a todos
sus adoptantes de golpe (con sus tests para demostrarlo).

**B. Copiar los cuatro ficheros a `src/` de tu app.**

Ventaja: la app queda completamente autocontenida y puede quedarse en una
versión antigua a propósito. Anota la versión (`WS_VERSION`) en el encabezado.

El CSS (`style/worldskin.css`) se concatena en el `index.css` de la app,
**anidado bajo su clase raíz**. Usa solo variables que la app ya define
(`--ks-*` o equivalentes) y no declara ninguna fuente ni imagen externa.

---

## 4. Garantías del paquete

Estas son las promesas que hacen que adoptarlo no sea un riesgo. Las verifica
`test/test-worldskin.mjs`.

1. **Cero red.** No hay `fetch`, `XMLHttpRequest`, `import()` ni `new Image()`.
   Todo el decorado es SVG y CSS generados en el propio bundle.
2. **Cero recursos externos.** Ni fuentes web, ni sprites, ni CDN. Las
   ambientaciones se dibujan con polígonos y variables de color.
3. **Mutaciones puras.** Todas las operaciones del mundo reciben el mundo y
   devuelven `{ world, ok, error|message }`. **Nunca lanzan** por datos del
   usuario y **nunca mutan** la entrada, así que un error del usuario no puede
   dejar el documento a medias.
4. **Simulación pura.** `wsSimStep(sim, world, dt, statusOf)` es una función:
   mismo estado + mismo `dt` ⇒ mismo resultado. Se puede probar sin navegador y
   pausarla no deja nada inconsistente.
5. **El bucle se porta bien.** Techo de 24 fps, `dt` acotado a 100 ms, pausa
   real con `document.hidden`, y **no arranca** si el usuario pidió
   `prefers-reduced-motion: reduce`. Se cancela en la baja del efecto.
6. **Cotas duras.** `WS_GRID_MAX = 40`, `WS_AREAS_MAX = 60`, `WS_STAFF_MAX = 200`.
   Un documento manipulado no puede pedir un mapa de un millón de celdas.
7. **Tolerante al cargar.** `wsMigrateWorld` acepta cualquier basura y devuelve
   un mundo válido: recorta, reubica al personal huérfano y no tira excepciones.
8. **El aspecto no cambia los datos.** Cambiar de forma o de modo no altera el
   mundo ni el flujo: la villa, el hotel y el territorio son tres proyecciones
   del mismo modelo, con las mismas áreas en las mismas celdas.
9. **Sin estado global.** Nada se cuelga de `globalThis`. Dos instancias de la
   misma app tienen mundos independientes.
10. **Sin permisos nuevos.** WorldSkin no necesita ningún permiso del manifiesto
    que la app no tuviera ya. No lee de otras apps ni escribe fuera de su
    instancia.

---

## 5. Verificación de la adopción

Antes de dar por buena una adopción, la app debe poder responder que sí a todo:

- [ ] `node packages/kimos-worldskin/test/test-worldskin.mjs` pasa **con el
      bundle de la app**, no solo con el paquete suelto.
- [ ] El bundle sigue siendo un módulo ESM válido y `mount(shell)` devuelve
      `{ Component, unmount }`.
- [ ] `unmount()` cancela el `requestAnimationFrame` (si no, la vista sigue
      animando después de cerrarse: se comprueba en el test del anfitrión).
- [ ] Cambiar de forma/modo **no** modifica el documento guardado más allá de
      `settings.theme`.
- [ ] El mundo se guarda en el documento de la instancia y sobrevive a recargar.
- [ ] El CSS del paquete está anidado bajo la clase raíz de la app y no define
      selectores globales (`body`, `:root`, `*`).

---

## 6. Versionado

`WS_VERSION` sube en el propio paquete. Los mundos guardados llevan
`wsVersion`, así que `wsMigrateWorld` puede reconocer documentos viejos.

- **Parche** — arreglos de dibujo o de simulación. Se puede vendorizar sin tocar
  el anfitrión.
- **Menor** — nuevas estructuras, departamentos o ambientaciones. Compatible:
  los mundos antiguos siguen cargando.
- **Mayor** — cambia la forma del mundo. Exige revisar `wsMigrateWorld` y volver
  a pasar el checklist del apartado 5 en **cada** app adoptante.

Los adoptantes se anotan en `README.md`. Si cambias algo mayor, es tu trabajo
pasar por esa lista.
