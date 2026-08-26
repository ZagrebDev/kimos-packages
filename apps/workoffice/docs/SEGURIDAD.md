# Seguridad y fiabilidad

El bundle de una app instalada **se ejecuta en la página del escritorio de
KIMOS**, con la sesión del usuario. No hay sandbox. Por eso las decisiones de
este documento no son opcionales.

---

## 1. El contenido del usuario nunca se convierte en HTML

Es la regla que atraviesa toda la app.

- **No hay `innerHTML`, ni `dangerouslySetInnerHTML`, ni `document.write`** en
  ninguna parte del código.
- El formato enriquecido se guarda como **texto plano con marcas**
  (`**negrita**`, `*cursiva*`, `` `código` ``, `[texto](url)`) y se pinta como
  **elementos React** (`MarkText` en `src/10-ui.js`). React escapa el texto: una
  nota que contenga `<script>alert(1)</script>` se ve como esos caracteres, no
  se ejecuta.
- La ventana de impresión se construye **nodo a nodo** (`createElement` +
  `textContent`), nunca con una cadena de HTML armada a mano (`printPage`,
  `printInline`).

Verificado en `test/render.test.mjs`: se inyecta `<img src=x onerror=…>` y
`<script>` en una nota y se comprueba que en el árbol renderizado **no existe**
ninguna de las dos etiquetas y que el texto aparece escapado.

```bash
# Comprobación sobre el bundle publicado, saltando los comentarios que
# justamente explican la regla (líneas que empiezan por * o //):
grep -nE "innerHTML|dangerouslySetInnerHTML|document\.write" dist/index.js \
  | grep -vE "^[0-9]+: *(\*|//)"      # debe salir vacío
```

## 2. Los enlaces solo pueden navegar

`safeHref()` acepta **únicamente** `https://`, `http://` y `mailto:`. Un
`[pincha](javascript:alert(1))` se pinta como texto, no como enlace. Los enlaces
que sí se crean llevan `target="_blank"` con `rel="noopener noreferrer nofollow"`,
para que la página destino no pueda manipular la ventana de KIMOS.

Verificado en las pruebas de render.

## 3. Una fórmula es un dato, no código

El motor **nunca** usa `eval` ni `new Function`: tokeniza, construye un árbol y
lo evalúa con funciones propias. Un nombre que parezca JavaScript
(`constructor`, `__proto__`, `toString`) es simplemente un nombre desconocido y
devuelve `#NAME?`. Lo peor que puede hacer una celda hostil es dar un error de
celda.

```bash
grep -nE "\beval\(|new Function" dist/index.js \
  | grep -vE "^[0-9]+: *(\*|//)"      # debe salir vacío
```

Además:
- **Referencias circulares** detectadas (`#CIRC!`): no cuelgan el navegador.
- **Rangos acotados**: máximo 20 000 filas × 702 columnas; un rango de más de
  200 000 celdas devuelve `#NUM!` en vez de agotar la memoria.
- **`REPETIR`** tope 5 000 caracteres; escrituras del agente, tope 20 000 celdas.
- Entradas absurdas (`=`, `=)`, `=;;`, `=1e999999`) devuelven un error de celda,
  nunca una excepción — hay una prueba dedicada a eso.

## 4. Inyección por CSV

Un CSV que empieza con `=`, `+`, `-` o `@` es el vector clásico de inyección en
hojas de cálculo. Aquí, **todo lo importado entra como texto**: si un valor
empieza por `=`, se antepone `'`. Aplica tanto a la importación de archivos como
a los datos traídos de otras apps de KIMOS (`importText` e `importKimos` en
`src/30-sheets.js`).

Las fórmulas solo existen cuando **una persona** las escribe en una celda.

## 5. Datos de otras apps: leer, nunca escribir

- Solo lectura, siempre (`shell.data.listInstances` / `listItems`).
- **El RBAC del usuario es el techo**: el permiso de la app nunca amplía lo que
  la persona ya puede ver.
- Los permisos son **granulares y justificados** uno a uno en el README; no se
  pide `data.read:*`.
- Se puede apagar por instancia desde ⚙️ Configurar.
- Tope defensivo de 12 instancias por app y 500 tareas / 200 notas externas: una
  app enorme no puede ahogar la ventana.
- Los valores que llegan de otra app se normalizan a texto plano antes de
  tocarse; un objeto anidado se descarta en vez de intentar pintarse.

## 6. Nombres de archivo y descargas

`download()` sanea el nombre (`[^\w.\- ]` → `_`, máximo 120 caracteres): un
archivo llamado `../../algo` no puede salir como ruta. El contenido va en un
`Blob` con `charset=utf-8` y la URL temporal se libera después.

## 7. Límites y validación de entrada

| Qué | Límite |
|---|---|
| Nombre de archivo | 120 caracteres |
| Nombre de hoja | 40 caracteres |
| Etiquetas por nota | 8, de 24 caracteres |
| Importación de CSV | 8 MB |
| Filas × columnas | 20 000 × 702 |
| Deshacer | 80 pasos por archivo |
| Escritura del agente | 20 000 celdas por acción |
| Documentos por combinación de correspondencia | 100 |

Todo dato que llega del servidor pasa por un normalizador
(`normalizeFile`, `sheetDoc`, `docDoc`, `deckDoc`, `noteDoc`, `eventDoc`) que
tolera basura: un archivo con `sheets: "no soy un array"` se abre vacío en vez
de romper la ventana. Hay una prueba que abre a propósito cuatro archivos con
datos corruptos.

## 8. El agente IA no puede hacer daño irreversible

- **No existe** ninguna herramienta de borrado definitivo ni de vaciar la
  papelera: `DELETE_FILE` solo mueve a la papelera. Hay una prueba que falla si
  alguien añade una.
- Todo input se valida: tipo de archivo, dirección A1, formato de fecha, rango
  horario, tamaño de la escritura.
- Los errores dicen qué había disponible, para que el agente corrija en el
  siguiente intento en vez de insistir a ciegas.
- El host fuerza el `app` de la acción al identificador real: la app no puede
  actuar en nombre de otra (APP-SPEC §6).

## 9. Fiabilidad: que no se pierda trabajo

- Autoguardado con reintento; lo que falla vuelve a la cola.
- `teardown()` vacía la cola pendiente al cerrar la ventana.
- Cola de red serializada: un guardado nunca se cruza con un refresco.
- La fusión **nunca** pisa un archivo que se está editando.
- Restaurar una versión desde 🗂️ Documentos **fusiona**: crea lo que falta y
  actualiza lo que cambió, sin borrar lo actual.
- Un `listener` roto no frena a los demás; `unmount` limpia temporizadores,
  escuchas y el registro del agente.

## 10. Lista de comprobación antes de publicar

```bash
node tools/build.mjs --check     # dist/ al día respecto de src/
node tools/test.mjs              # 127 pruebas
node tools/audit.mjs             # innerHTML, eval, esquemas de enlace
node tools/check-versions.mjs workoffice   # desde kimos-packages
```

Los cuatro pasos tienen que salir en verde. Si alguno falla, no se publica.
