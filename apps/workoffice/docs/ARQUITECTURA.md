# Arquitectura y construcción, paso a paso

Cómo está armada la app, en el orden en que se construyó y en el orden en que
conviene leerla.

---

## 1. La decisión de fondo: un archivo = un registro

Una instancia de la app es un **espacio de trabajo**. Cada archivo —documento,
hoja, presentación, nota o evento— es un *item* de esa instancia
(`shell.items`), no una parte de un blob único.

Se descartó `saveData()` con todo el espacio dentro por tres razones:

1. **Nadie se pisa.** El CRUD ya es por archivo: dos personas editando archivos
   distintos escriben registros distintos (APP-SPEC §5.1).
2. **Escala.** El peso del espacio no entra en cada guardado; se guarda solo el
   archivo tocado.
3. **Se puede listar sin abrir.** El explorador pinta nombres, fechas y autores
   sin cargar el contenido de cada archivo.

Forma de un archivo:

```jsonc
{
  "id": "it42",
  "kind": "sheet",              // doc | sheet | deck | note | event
  "name": "Ventas 2026",
  "star": false, "trashed": false,
  "data": { /* específico del módulo */ },
  "createdAt": "…", "createdBy": "…", "createdById": "…",
  "updatedAt": "…", "updatedBy": "…", "updatedById": "…"
}
```

`updatedAt` por archivo es lo que permite fusionar sin perder trabajo: gana el
más reciente **por archivo**, no por espacio.

---

## 2. Los módulos, en el orden en que se construyeron

Cada paso se cerró con su verificación antes de empezar el siguiente.

| # | Archivo | Qué resuelve | Verificado con |
|---|---|---|---|
| 1 | `src/00-core.js` | Estado, almacén sobre `shell.items`, autoguardado, sincronización, ciclo de vida | `test/app.test.mjs` (persistencia real contra un `shell` simulado) |
| 2 | `src/10-ui.js` | Botones, menús, diálogos, vacíos, texto con marcas, impresión, descargas | `test/render.test.mjs` |
| 3 | `src/20-formula.js` | Motor de fórmulas: tokenizador, parser, evaluador, formatos | `test/formula.test.mjs` (86 pruebas) |
| 4 | `src/30-sheets.js` | Grilla virtualizada, selección, edición, hojas, CSV, deshacer | render + integración |
| 5 | `src/35-kimos-data.js` | Puente `shell.data` con Productos, Clientes, Pedidos, Planificación y Notas de Equipo | degradación sin `shell.data` probada |
| 6 | `src/40-docs.js` | Documentos por bloques, Markdown de ida y vuelta, índice, combinación de correspondencia | render |
| 7 | `src/50-slides.js` | Diapositivas, plantillas, notas del orador, modo presentación | render |
| 8 | `src/60-notes.js` | Tablero de notas, colores, etiquetas, pestaña del equipo | render |
| 9 | `src/70-calendar.js` | Mes, semana, agenda, eventos, superposición de Planificación | render |
| 10 | `src/80-drive.js` | Inicio: recientes, favoritos, papelera, búsqueda global, explorador por tipo | render |
| 11 | `src/85-agent.js` | 13 herramientas para el agente IA, con validación | integración (30 pruebas) |
| 12 | `src/90-app.js` | Cabecera, navegación, paleta de comandos, atajos, arranque | render |

El orden numérico **es** el orden de concatenación en el bundle. Cambiarlo
cambia el orden de inicialización.

---

## 3. El compilador propio (`tools/build.mjs`)

El host sirve `dist/index.js` tal cual: sin `npm install`, sin paso de build, y
con la obligación de usar el React del host. Un bundler de verdad traería
dependencias y el riesgo de empaquetar otra copia de React — justo lo que el
contrato prohíbe.

**Convención**: cada archivo de `src/` es un *fragmento de cuerpo de función*
—sin `import` ni `export`— y el compilador los concatena dentro de la plantilla
de `mount(shell)`. Así todos comparten el mismo closure: el estado es de la
ventana, nunca del módulo. El compilador **rechaza** un fragmento que use
`import`/`export`, porque rompería el closure.

```bash
node tools/build.mjs          # genera dist/index.js + dist/index.css
node tools/build.mjs --check  # falla si dist/ quedó desactualizado (CI)
node tools/test.mjs           # compila y corre las tres suites
```

`APP_VERSION` se inyecta desde `manifest.json` al compilar: no puede
desincronizarse de lo que muestra la app en pantalla (APP-SPEC §7.a).

---

## 4. Cómo se guarda (y por qué no se pierde nada)

```
escribir  →  patchFile()  →  pantalla al instante
                          →  cola `dirty`
                          →  debounce 1,2 s  →  flushSaves()  →  shell.items.update()
```

- **Cola serializada** (`enqueue`): un guardado nunca se cruza con un refresco;
  si se cruzaran, el refresco podría pisar en pantalla lo que el guardado acaba
  de mandar.
- **Fallo de red**: el cambio vuelve a la cola y se reintenta; el indicador pasa
  a *Sin conexión*.
- **Al cerrar**: `teardown()` vacía la cola pendiente.
- **Ctrl+S** fuerza el vaciado para quien lo necesita.

### Sincronización con el equipo

Sin canal de *push* del servidor, el patrón es el de la casa (APP-SPEC §5.1):
sondeo con cadencia según el foco —20 s enfocado, 60 s de fondo, **en pausa** si
la pestaña no se ve— y **fusión, no reemplazo**:

1. Lo remoto manda, salvo que aquí haya algo más nuevo o sin guardar.
2. Un archivo que se está editando (`dirty`) nunca se pisa.
3. Auto-reparación acotada: lo propio y recién creado (< 20 s) que el servidor
   aún no devuelve no desaparece de la pantalla. Pasado ese margen, si sigue sin
   estar, es que alguien lo borró.
4. No se repinta si la firma del listado no cambió: repintar cada 20 segundos
   molesta a quien está escribiendo.

---

## 5. El motor de fórmulas

```
"=SUMA(A1:A3)*2"
   → tokenize()      tokens: name, range, op, num
   → parseFormula()  AST por descenso recursivo, precedencia de Excel
   → evalAst()       evaluación perezosa contra la hoja
   → formatValue()   texto que ve el usuario
```

- **Nunca `eval` ni `new Function`.** Una fórmula es un dato, no código. Lo peor
  que puede hacer una celda hostil es devolver `#VALUE!`.
- **Evaluación perezosa con memoria**: una hoja de 50 000 celdas con 12 visibles
  no recalcula 50 000.
- **Ciclos detectados**: `A1 = A1 + 1` devuelve `#CIRC!`, no cuelga el navegador.
- **Precedencia de Excel**, incluido `-2^2 = 4` (el unario liga más que la
  potencia) y `^` asociativa por la derecha.
- **Tipos**: número, texto, booleano, fecha (`{__d}` días desde 1970) y error
  (`{e}`). Fecha ± número sigue siendo fecha; fecha − fecha son días.
- **~60 funciones** con nombre en español e inglés.

Convención decimal: en fórmulas el punto es decimal y `;` separa argumentos; la
coma se acepta como decimal **solo entre dígitos** (`2,5`), y en cualquier otra
posición separa argumentos. Es lo que hace convivir un teclado en español con
las fórmulas copiadas de Excel.

---

## 6. La grilla

- **Virtualización por filas**: se montan `visibles + 6` filas arriba y abajo; el
  alto total se reserva con un contenedor absoluto. Las columnas se pintan todas
  (26 por defecto), que es más barato que virtualizar en dos ejes.
- **Encabezados fijos** con `position: sticky`, incluida la esquina.
- **Deshacer** por parches inversos (hasta 80 pasos por archivo): se guarda solo
  lo que cambió, no la hoja entera — salvo en operaciones que mueven toda la
  hoja (insertar/borrar filas, importar), donde sí se guarda una instantánea.
- **Insertar y borrar filas/columnas reescribe las fórmulas** (`rewriteRefs`),
  respetando referencias absolutas (`$A$1`) y dejando `#REF!` cuando la
  referencia apuntaba a lo borrado.
- **Pegar** desde la propia app corre las referencias relativas; desde fuera,
  entra como texto plano (CSV/TSV con separador adivinado).

---

## 7. Qué queda fuera, a propósito

| Fuera | Por qué | Camino si se pide |
|---|---|---|
| Leer/escribir `.docx`, `.xlsx`, `.pptx` | Librerías pesadas ejecutándose en la sesión del usuario | Conversión en el backend, no en el bundle |
| Edición concurrente carácter a carácter | No hay push del servidor (APP-SPEC §5.1) | Requiere contrato nuevo — ver INTEGRACION-KIMOS §5 |
| Gráficos en la hoja | Alcance; el motor y el documento ya lo permiten | Un tipo de bloque `chart` sobre el modelo actual |
| Imágenes dentro de documentos y diapositivas | Los assets solo llegan por `.kapp` hoy | `shell.files` de AppShell v2 |
| Carpetas | Decisión de producto | Etiquetas para todos los tipos |

---

## 8. Dónde tocar para cada cambio

| Quiero… | Archivo |
|---|---|
| Añadir una función de fórmula | `src/20-formula.js` → `defFn(...)` + prueba en `test/formula.test.mjs` |
| Cambiar cómo se guarda o sincroniza | `src/00-core.js` |
| Añadir un tipo de archivo | `KINDS` y `MODULES` en `src/00-core.js`, un módulo nuevo, y `textExtractors` |
| Añadir una herramienta al agente | `src/85-agent.js` → `AGENT_TOOLS` + `agentDispatch` |
| Cambiar el aspecto | `styles/index.css` (solo tokens del tema, nunca colores fijos) |
| Añadir una preferencia ⚙️ | `manifest.json` → `configSchema` + `DEFAULT_CFG` en `src/00-core.js` |
| Integrar otra app de KIMOS | `src/35-kimos-data.js` + permiso `data.read:` en el manifest |
