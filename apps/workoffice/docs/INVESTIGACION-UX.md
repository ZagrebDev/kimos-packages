# Investigación de experiencia de usuario

Este documento explica **por qué Kimos WorkOffice es como es**. No es un
catálogo de buenas intenciones: cada hallazgo termina en una decisión concreta
del producto y, cuando corresponde, en el archivo donde vive esa decisión.

Las fuentes son las que se pudieron examinar de primera mano:

| Fuente | Qué se miró |
|---|---|
| `kimos-packages` (este ecosistema) | `APP-SPEC.md`, `CREA-TU-APP.md`, y las apps `productlab`, `gantt`, `notas-equipo`, `kanban` — código y estilos reales |
| [silevis/reactgrid](https://github.com/silevis/reactgrid) | Modelo de grilla: virtualización, selección, foco de celda |
| [dream-num/univer](https://github.com/dream-num/univer) | Separación documento / motor / vista en una suite ofimática web |
| Suites de referencia citadas por el equipo | LibreOffice, ONLYOFFICE, FreeOffice, Google Workspace, Microsoft 365 — modelo de uso local + nube + equipo |

> Nota de honestidad: no se realizaron pruebas de usabilidad con usuarios reales
> para esta primera versión. Lo que sigue es análisis de producto y de código
> comparado, más las convenciones ya validadas dentro de KIMOS. La sección final
> propone qué medir para convertir estas hipótesis en evidencia.

---

## 1. El punto de partida: qué pidió el equipo

Del extracto de conversación compartido, el requisito real no era "una suite
ofimática" sino tres cosas a la vez:

1. **Uso personal** — abrir algo y escribir, sin ceremonia.
2. **Trabajo en equipo** — varias personas sobre el mismo material.
3. **Nube y local** — que el trabajo no viva atrapado en un solo lugar.

La conclusión del propio equipo fue que ONLYOFFICE y Google Workspace resuelven
los tres, pero **ambos obligan a salir de la plataforma**: otra cuenta, otro
lugar donde buscar, otros permisos que administrar. Ese es exactamente el costo
que WorkOffice elimina: la suite vive **dentro** del escritorio de KIMOS, con la
identidad, los equipos y los permisos que ya existen.

Cómo se cubre cada requisito:

| Requisito | Cómo lo resuelve WorkOffice |
|---|---|
| Personal | Un espacio de trabajo por instancia; abrir y escribir sin configurar nada |
| Equipo | Un archivo = un registro: dos personas en archivos distintos nunca se pisan; sincronización periódica y fusión por archivo |
| Nube | Persistencia del host (`shell.items`), con el RBAC de KIMOS |
| Local | Exportación real a CSV, Markdown y PDF/impresión, e importación de CSV. Lo que se escribe se puede sacar |

**Lo que NO se prometió**: edición binaria de `.docx`/`.xlsx`/`.pptx`. Escribir
esos formatos requiere librerías pesadas y ejecutarlas en la sesión del usuario;
se optó por formatos abiertos y verificables (CSV, Markdown, PDF vía impresión).
Está anotado como evolución en [ARQUITECTURA.md](ARQUITECTURA.md#qué-queda-fuera-a-propósito).

---

## 2. Hallazgos y decisiones

### 2.1 El costo real no es escribir, es *encontrar*

En una suite de equipo, el tiempo se va en localizar el archivo, no en editarlo.
Google Workspace lo resolvió con búsqueda de contenido; las suites de escritorio
siguen dependiendo de carpetas que solo entiende quien las creó.

**Decisión — no hay carpetas.** Manda el uso: recientes primero, favoritos
arriba, y un buscador que entra en el **contenido** de todos los archivos, no
solo en el nombre (`searchFiles` en `src/00-core.js`). Las notas se agrupan con
`#etiquetas` escritas en el propio texto, sin un campo aparte que rellenar.

*Riesgo asumido*: en espacios muy grandes puede faltar jerarquía. Es medible
(ver §4) y la respuesta preparada son etiquetas para todos los tipos, no
carpetas.

### 2.2 Cambiar de herramienta no debe cambiar de contexto

Un informe real salta entre módulos: se pega una tabla, se arma la presentación,
se agenda la reunión donde se presenta. En las suites clásicas cada salto es una
aplicación distinta, con su propia ventana y su propio "abrir archivo".

**Decisión — una sola ventana, cinco módulos, un estado.** Cambiar de módulo no
recarga nada ni pierde lo escrito (`src/90-app.js`). Y el **mismo texto con
marcas** (`**negrita**`, `*cursiva*`, `[enlace](url)`) se usa en Documentos,
Notas y Presentaciones: se copia y pega entre módulos sin convertir nada.

### 2.3 Nadie debe preguntarse si su trabajo se guardó

Es la angustia clásica del usuario de oficina, y la razón por la que la gente
pulsa Ctrl+S compulsivamente.

**Decisión — autoguardado con estado siempre a la vista.** Un indicador en la
cabecera muestra *Guardando / Guardado / Sin conexión* (`SaveDot`), Ctrl+S sigue
funcionando para quien lo necesita psicológicamente, y al cerrar la ventana se
vacía la cola pendiente (`teardown` en `src/00-core.js`). Si falla la red, el
cambio vuelve a la cola y se reintenta: no se pierde ni se miente.

### 2.4 Borrar tiene que doler poco y equivocarse, menos

**Decisión — papelera de dos pasos.** Eliminar mueve a la papelera (reversible);
el borrado definitivo es explícito, con confirmación que nombra el archivo. El
**agente IA no tiene herramienta de borrado definitivo**: lo irreversible se
queda en manos de la persona (`src/85-agent.js`, verificado en las pruebas).

### 2.5 La hoja de cálculo se juzga por lo que rompe, no por lo que hace

De **ReactGrid** se tomó el modelo de grilla: no montar 20 000 filas, pintar solo
la ventana visible y reservar el resto con un espaciador; el teclado manda
(flechas, Tab, Enter, F2, Ctrl+flechas, Inicio/Fin, RePág/AvPág) y escribir sobre
una celda reemplaza su contenido, como en Excel.

De **Univer** se tomó la separación estricta **documento / motor / vista**: el
documento es JSON plano (`src/30-sheets.js`), el motor de fórmulas es
independiente y probable (`src/20-formula.js`, 86 pruebas), y la vista no calcula
nada. Gracias a eso, guardar, deshacer, exportar, imprimir y el agente IA usan
el mismo camino.

Ninguno de los dos se empaqueta como dependencia: el contrato de KIMOS exige un
bundle autocontenido que use el React del host (APP-SPEC §3).

Tres detalles que son la diferencia entre una hoja usable y una que miente:

- **Insertar o borrar una fila reescribe las fórmulas.** Sin eso, insertar una
  fila arriba rompe en silencio todas las sumas — el fallo más caro de una
  planilla (`shiftRowsCols`).
- **Los errores se explican en castellano.** `#DIV/0!` lleva *"División por cero:
  revisa el divisor"* en el tooltip (`errorHelp`). Un código a secas no ayuda.
- **El redondeo es decimal, no binario.** `REDONDEAR(1,005;2)` da `1,01`, no `1`.
  Es el error que un usuario detecta el primer día trabajando con precios
  (`shiftDecimal`).

### 2.6 Español de verdad, no un producto traducido

**Decisión — nombres de función en español *y* en inglés.** `SUMA` y `SUM`,
`BUSCARV` y `VLOOKUP`, `SI` y `IF`: la misma hoja funciona la copie quien la
copie desde Excel o desde Sheets. Los números se muestran con miles en punto y
decimales en coma, y la coma decimal se acepta al escribir (`2,5`) mientras el
`;` separa argumentos — la convención que hace convivir un teclado en español
con las fórmulas de toda la vida.

### 2.7 Descubrimiento sin manual

**Decisión — paleta de comandos (Ctrl+K) con el atajo escrito en pantalla.** Un
solo lugar para crear, buscar y navegar. Quien la usa a diario no vuelve a tocar
el ratón; quien llega nuevo la descubre porque el botón «🔎 Buscar Ctrl+K» está
en la cabecera. Además, los atajos de Markdown al escribir (`## `, `- `, `> `)
enseñan el formato mientras se usa.

### 2.8 Accesibilidad como parte del trabajo, no como parche

- Roles y etiquetas ARIA en pestañas, listas, diálogos y celdas.
- Todo lo importante es alcanzable por teclado; los diálogos cierran con `Esc`.
- Ningún estado se comunica **solo** por color (los eventos llevan texto, las
  tareas de Planificación llevan icono y trama).
- `prefers-reduced-motion` apaga las animaciones.
- Contraste heredado de los tokens del tema: la app cambia de día a noche con
  KIMOS sin escuchar nada (APP-SPEC §9).

### 2.9 La app vive en una ventana, no en una pantalla

Las apps de KIMOS se abren en ventanas del escritorio, a veces angostas.

**Decisión —** a 900 px la navegación deja solo iconos y se ocultan el índice del
documento y las miniaturas; a 620 px el calendario compacta las celdas. Nada
desborda horizontalmente y la raíz siempre ocupa el 100 % sin scroll propio.

---

## 3. Qué se descartó, y por qué

| Idea | Por qué no |
|---|---|
| Editor `contenteditable` (WYSIWYG clásico) | Guarda HTML; HTML guardado es HTML que hay que volver a pintar — el camino directo a una inyección en el escritorio. Se usan bloques de texto plano con marcas |
| Colaboración en tiempo real carácter a carácter (CRDT) | El contrato no tiene canal de *push* del servidor (APP-SPEC §5.1). Prometer tiempo real sobre sondeo sería mentir. Se eligió granularidad por archivo, que con el patrón de la casa **sí** se cumple |
| Carpetas | §2.1 |
| Formatos binarios `.docx`/`.xlsx` | §1 |
| Traer una librería de hojas de cálculo completa | Ejecutar código de terceros en la sesión del usuario y engordar el bundle; el subconjunto que cubre el uso real cabe en un archivo auditable |

---

## 4. Qué medir en la versión 1.1

Las decisiones de arriba son hipótesis razonadas. Para convertirlas en evidencia,
lo que habría que observar con los primeros equipos:

1. **Buscar vs. navegar**: ¿cuántas aperturas de archivo llegan por la paleta y
   cuántas por la lista? Si la lista gana en espacios grandes, faltan etiquetas.
2. **Fórmulas que fallan**: qué errores de celda aparecen más. Si `#NAME?`
   domina, faltan funciones o falta autocompletado en la barra de fórmulas.
3. **Papelera**: cuántos archivos se restauran. Un número alto valida los dos
   pasos; un cero sugiere que sobra la fricción.
4. **Módulo de entrada**: qué preferencia de inicio elige la gente. Indica para
   qué se usa realmente la suite.
5. **Conflictos de edición**: cuántas veces dos personas tocan el mismo archivo
   a la vez. Si es frecuente, hay que subir la granularidad de la fusión de
   archivo a bloque/celda.

---

## 5. Resumen: la decisión en una línea

> Una sola ventana, sin carpetas, que guarda sola, que se maneja con el teclado,
> que habla español, que nunca convierte el texto del usuario en HTML, y que lee
> el resto de KIMOS en vez de duplicarlo.
