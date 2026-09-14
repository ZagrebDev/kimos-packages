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
| 2b | `src/12-ribbon.js` | Cinta de opciones con pestañas y grupos | render |
| 2c | `src/14-autocorrect.js` | Autocorrección tipográfica | `test/autocorrect.test.mjs` (19 pruebas) |
| 3 | `src/20-formula.js` | Motor de fórmulas: tokenizador, parser, evaluador, formatos | `test/formula.test.mjs` (86 pruebas) |
| 3b | `src/22-odf.js` | OpenDocument: ZIP, XML, OpenFormula, .ods/.odt/.odp | `test/odf.test.mjs` (26 pruebas, con esquema OASIS) |
| 4 | `src/30-sheets.js` | Grilla virtualizada, selección, edición, hojas, CSV, deshacer | render + integración |
| 5 | `src/35-kimos-data.js` | Puente `shell.data` con Productos, Clientes, Pedidos, Planificación y Notas de Equipo | degradación sin `shell.data` probada |
| 5b | `src/36-storage.js` | Cloud Storage: subir, releer, descargar y borrar archivos reales | `test/storage.test.mjs` (23 pruebas) |
| 5c | `src/38-files.js` | Módulo Archivos, arrastrar y soltar, previsualización, selector de adjuntos | render |
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
- **56 funciones**, invocables por 112 nombres: cada una responde a su nombre
  en español y en inglés.

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

## 6.b El Cloud Storage

El contrato **no está en APP-SPEC**: se tomó del código de `productlab`, que ya
sube en producción.

```
ESCRITURA   POST {API}/api/v2/files      FormData { path, file }   · shell.authFetch
LECTURA     GET  {API}/api/public/files/{path}                     (área pública)
            GET  {API}/api/storage/teams/{teamId}/files/download?path=…   (área del equipo)
```

**Dos destinos, y el privado manda.** ProductLab cuelga todo de `imagenes/`
porque ese prefijo se sirve **sin autenticación**. Para fotos de catálogo está
bien; para una suite ofimática sería un fallo grave. Por eso:

| Destino | Ruta | Quién lo ve |
|---|---|---|
| 🔒 **Privado del equipo** (por defecto) | `equipos/{teamId}/workoffice/{instanceId}/…` | Solo quien tiene acceso al equipo |
| 🌐 **Enlace público** (explícito) | `imagenes/workoffice/{instanceId}/…` | Cualquiera con el enlace |

**Verificación de ida y vuelta.** La escritura está confirmada; que el área del
equipo se pueda *releer* por ese camino depende de cómo esté cableado el
backend, y eso no se deduce leyendo otra app. Así que la primera subida de cada
destino se sube **y se vuelve a leer**. Si la relectura falla, el destino se
marca no disponible y se dice en pantalla — nunca queda un adjunto que parece
guardado y no se puede abrir.

**Cómo se ve un archivo privado.** No se puede poner en un `src` a secas: hace
falta la sesión. Se descarga con `authFetch`, se convierte en URL de objeto y se
cachea por ruta; `teardown()` las libera todas.

**El adjunto es un archivo del espacio** (`kind: 'attach'`): el item guarda ruta
y metadatos, no el binario. Así hereda buscador, favoritos y papelera, y la
misma imagen se usa en varios documentos sin duplicar bytes.

**Lo que no se pudo confirmar** y por eso se maneja con honestidad: el endpoint
de **borrado**. Se intenta `DELETE /api/v2/files?path=…`; si el servidor no lo
soporta, el adjunto sale del espacio de trabajo pero se avisa de que el binario
puede seguir ocupando almacenamiento. Prometer un borrado que no ocurrió sería
peor que no borrar.

---

## 6.c OpenDocument

Toda la interoperabilidad cabe en `src/22-odf.js`, sin una sola dependencia:

```
escritor ZIP («store»)  ·  lector ZIP (store + deflate vía DecompressionStream)
lector XML propio       ·  OpenFormula ida y vuelta
```

**Por qué un lector XML propio y no `DOMParser`**: no entiende DOCTYPE ni
entidades, así que un `.ods` hostil no puede montar una expansión de entidades
ni pedirle al navegador que abra otra cosa. Si aparece un DOCTYPE, se rechaza el
archivo.

**Por qué ZIP sin comprimir**: ODF lo admite, cabe en 40 líneas y evita traer
una librería de deflate. Un documento de oficina pesa kilobytes. `mimetype` va
primero y sin comprimir, como exige OpenDocument §3.3.

**Las fórmulas viajan de verdad.** `toOpenFormula` traduce `=SUMA(B2:B3)` a
`of:=SUM([.B2:.B3])` —nombres al inglés canónico (`FN_CANON`), referencias entre
corchetes, booleanos como `TRUE()`— y `fromOpenFormula` deshace el camino. Por
eso el motor acepta también `TRUE()`/`FALSE()`: es como los escribe ODF.

La decisión completa, con la matriz de qué se adoptó y qué se descartó de
ONLYOFFICE y LibreOffice, está en
[`ADOPCION-ONLYOFFICE-LIBREOFFICE.md`](ADOPCION-ONLYOFFICE-LIBREOFFICE.md).

---

## 7. Qué queda fuera, a propósito

| Fuera | Por qué | Camino si se pide |
|---|---|---|
| Leer/escribir `.docx`, `.xlsx`, `.pptx` | OOXML necesita bastante más superficie y compresión real | El ZIP y el lector XML ya están: falta el mapeo de sus esquemas |
| Imágenes dentro del ODF exportado | Alcance de la 1.2 | Empaquetar el binario en `Pictures/`, ahora que los adjuntos viven en el Storage |
| Edición concurrente carácter a carácter | No hay push del servidor (APP-SPEC §5.1) | Requiere contrato nuevo — ver INTEGRACION-KIMOS §5 |
| Gráficos en la hoja | Alcance; el motor y el documento ya lo permiten | Un tipo de bloque `chart` sobre el modelo actual |
| Miniaturas generadas en el servidor | Hoy la imagen se descarga entera para verla | Un endpoint de *thumbnail* en el backend |
| Versionado de un adjunto (subir una revisión) | Alcance; el modelo ya lo admite | Una lista de rutas por adjunto en vez de una |
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
| Cambiar cómo se suben archivos | `src/36-storage.js` (contrato) y `src/38-files.js` (interfaz) |
| Tocar la exportación a ODF | `src/22-odf.js` + `test/odf.test.mjs` |
| Añadir una regla de autocorrección | `AUTOCORRECT_RULES` en `src/14-autocorrect.js` |
| Cambiar la cinta de un módulo | El array `tabs` que ese módulo pasa a `Ribbon` |
