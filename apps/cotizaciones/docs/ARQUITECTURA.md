# Arquitectura de Cotizaciones

Notas para quien tenga que tocar esta app dentro de seis meses. No repite lo
que ya dice el `README.md` (qué hace y cómo se usa): esto es **por qué está
construida así**.

## Una instancia = un cotizador

Todo vive como *items* de la instancia (`shell.items`), distinguidos por
`kind`. Se eligió item-por-cotización y no un único blob con `saveData` por
tres razones, las mismas que WorkOffice:

1. **Nadie se pisa.** El CRUD ya es por documento: dos personas editando
   cotizaciones distintas escriben registros distintos (APP-SPEC §5.1).
2. **Escala.** El peso del cotizador entero no entra en cada guardado.
3. **Consulta.** Otras apps pueden leer las cotizaciones con `shell.data` sin
   tener que descomponer un blob.

El item `definition` (id fijo) guarda emisor, reglas y correlativo. Id fijo a
propósito: dos personas abriendo el cotizador por primera vez escriben el
**mismo** documento en vez de duplicarlo.

## Las capas, y por qué existen

```
src/00-core.js        modelo, motor de totales, correlativo   (puro)
src/10-store.js       estado, red, fusión multiusuario
src/20-ui.js          componentes base
src/25-files.js       subida de imágenes
src/30-actions.js     ▶ QUÉ PUEDE HACER LA APP ◀
src/40-quotes.js      listado y editor de datos
src/45-templates.js   plantillas, revisiones, diálogo de creación
src/50-settings.js    ajustes
src/60-catalog-*.js   motor, lectura y pantallas del catálogo
src/66-records.js     identidad compartida del cliente y marca del tenant
src/70-blocks.js      modelo y pintado de la propuesta          (compartido)
src/72-canvas.js      edición visual del lienzo
src/80-export.js      PDF y enlace público
src/85-mail.js        plantillas de correo
src/87-send.js        diálogo de envío
src/88-board.js       tablero de seguimiento
src/90-app.js         chrome y enrutado
src/95-agent.js       agente IA
```

**La capa de acciones (`30-actions.js` y las `act*` repartidas) es la pieza
clave.** Existe separada por una razón concreta: el agente IA tiene que poder
hacer exactamente lo mismo que una persona, y la única forma de garantizarlo
es que ambos llamen a las mismas funciones. La UI no muta el modelo por su
cuenta y el agente no tiene un camino paralelo. Si añades una capacidad,
añádela ahí y expónla en los dos sitios.

Los fragmentos de `src/` **no son módulos ESM**: `tools/build.mjs` los
concatena dentro del closure de `mount(shell)` en orden alfabético. El prefijo
numérico fija ese orden. Solo importa para el código que se ejecuta al montar
(constantes de nivel superior); las funciones se declaran y se usan después.

## Decisiones que costaron pensar

### Un solo maquetador para el lienzo y el PDF

El lienzo y la ventana de impresión renderizan **los mismos componentes**
(`Sheet` / `Block` de `70-blocks.js`). Si hubiera dos maquetadores, el PDF
acabaría divergiendo de lo que se ve en pantalla; con uno, no puede.

Por lo mismo, la ventana de impresión **enlaza** la hoja de estilos publicada
de la app (`/api/apps/cotizaciones/bundle.css`) en vez de llevar una copia.

### Cuadrícula que fluye, no coordenadas

Los bloques declaran cuántas columnas ocupan y fluyen en orden. Una cotización
termina en un PDF paginado, y una cuadrícula que fluye se pagina sola; con
posicionamiento absoluto habría que resolver a mano qué cae en cada página.

### La línea congela el precio

Una cotización es **una oferta con fecha**. Cuando se cotiza un producto del
catálogo, la línea guarda el precio, la descripción y la combinación elegida
en ese momento. Si mañana sube el catálogo, lo enviado sigue diciendo lo
mismo. Solo el botón ⟳ de la fila (o el agente, si se lo piden) lo actualiza.

### Revisar en vez de reescribir

Una cotización enviada no se edita: se emite una **revisión** con el mismo
número y sufijo `-R2`, y la original queda marcada como sustituida, con su
estado y sus precios intactos. Fuera hay una copia de lo que salió; el sistema
tiene que poder mostrar lo mismo.

### El color nunca es el único portador

- Los estados llevan su nombre como texto y el color por clase CSS, con
  variante de modo noche.
- El tablero codifica magnitud con **longitud** de barra en un solo tono
  derivado de `--foreground`. Una paleta por estado habría puesto verde
  («ganada») contra rojo («perdida») —ΔE 4,2 bajo deuteranopia— a distinguir
  el dato más importante del tablero.

### El cliente: referencia Y copia, no una de las dos

Cuando el cliente vive solo dentro de la cotización, seis meses después hay
tres «Acme SpA» en el sistema y ninguna vista completa. Cuando vive solo en un
registro central, una propuesta enviada cambia de nombre sola el día que
alguien corrige la ficha —y lo que se envió al cliente no cambia solo (mismo
criterio que las revisiones).

Así que se guardan las dos cosas:

- `client.recordRef` — `kimos:record/account/…`, la identidad compartida. Es
  lo que permite decir «esta cotización y ese proyecto son del mismo
  cliente», y lo que hace que escribir el RUT de otra forma no cree un
  segundo cliente (la plataforma normaliza antes de comparar).
- `client.name`, `taxId`, `email`… — la instantánea. Es lo que se imprime.

Refrescar la instantánea es un acto explícito, nunca automático, igual que
actualizar el precio de una línea desde el catálogo. Y si el registro
desaparece, no se borra nada: la cotización sigue diciendo lo que decía.

Todo esto es opcional en los dos sentidos: `shell.records` puede no existir
en un host anterior, y entonces la app funciona exactamente como la 1.0 (hay
una prueba que lo comprueba montando la app con un shell sin registro).

### El adjunto del correo

El PDF lo produce el diálogo de impresión del navegador y lo escribe la
persona en su disco: la página **nunca recibe ese archivo**. Adjuntarlo
automáticamente exigiría renderizarlo en el servidor (Chromium headless o
WeasyPrint en `kimos-enterprice`), una dependencia bastante mayor que lo que
resuelve. Se ofrecen tres caminos y la UI explica cuál es cuál.

## Colaboración multiusuario

Implementa el patrón completo de APP-SPEC §5.1, con `apps/gantt` como
referencia:

1. **Fusionar, no reemplazar**: cada línea lleva su `updatedAt` y gana la más
   reciente **por línea**. La cabecera se resuelve en bloque por
   `metaUpdatedAt`.
2. **Lápidas** (`deletedLines`) para que lo que borra una persona no
   reaparezca desde la pantalla de otra.
3. **Leer-fusionar-escribir** antes de cada `PUT`: el backend hace merge de
   campos de primer nivel, así que el array `lines` se reemplaza entero y la
   fusión tiene que ocurrir en el cliente.
4. **Auto-reparación** de la ventana de red entre el read y el write, acotada
   a lo propio y reciente para no resucitar lo que borró otra persona.
5. **No repintar de más**: se compara una firma de lo visible.
6. **Cadencia según el foco**: rápida enfocada, lenta de fondo, en pausa si la
   pestaña no se ve.

## Dependencias externas

Ninguna en tiempo de ejecución más allá del contrato del host:

| Necesita | De dónde |
|---|---|
| `globalThis.React` | el shell |
| `globalThis.ReactDOM` | el shell (para pintar la hoja en la ventana de impresión) |
| `shell.items`, `saveData/loadData`, `config`, `documents` | AppShell v1 |
| `shell.data` (lectura) | catálogos de Productos, ProductLab y Clientes |
| `shell.data.create` | guardar en la app Clientes un cliente escrito a mano (opcional) |
| `shell.records` | identidad compartida del cliente (opcional: si falta, la app funciona igual) |
| `shell.brand` | marca del tenant para rellenar el emisor (opcional) |
| `shell.files` | subir imágenes y la propuesta publicada; si falta, se usa `authFetch` a `/api/v2/files` |
| `shell.authFetch` | `/api/identity/me`, `/api/integrations/email/*` y el respaldo de subida |

El endpoint `POST /api/integrations/email/send` se añadió en
`kimos-enterprice` para esta app; es una capacidad de sistema reutilizable,
no lógica de cotizaciones en el backend. Si no existe en el tenant, la app lo
detecta y explica qué falta en vez de fallar al pulsar enviar.

## Pruebas

`test/test-app.mjs` monta el bundle con un `shell` y un React simulados y
ejercita el modelo por las mismas acciones que usan la UI y el agente. Cubre
el motor de totales contra los números de propuestas reales, el correlativo,
la vigencia, las plantillas y revisiones, el catálogo (incluido el motor de
precios de ProductLab con margen 0 %), el lienzo, la exportación con una
ventana de impresión simulada, el correo con un SMTP simulado, el tablero, el
agente y el render de todas las pantallas.

```bash
node tools/build.mjs && node test/test-app.mjs
```

Si tocas `src/`, **recompila antes de probar**: el banco de pruebas importa
`dist/index.js`, no las fuentes.
