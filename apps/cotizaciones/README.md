# Cotizaciones (app oficial)

**Versión actual: 1.0.0**

Cotizaciones y propuestas comerciales de punta a punta dentro de KIMOS: se
arman, se guardan, se reutilizan, se exportan a PDF, se envían por correo y se
les hace seguimiento hasta que se ganan o se pierden.

Una **instancia = un cotizador**: su emisor, su correlativo y sus reglas. Un
equipo puede tener varios (por marca o por unidad de negocio) y cada uno lleva
lo suyo.

## Qué hace

- **Cotizaciones** con cliente, vigencia, líneas, descuentos, impuesto y
  desglose de abono y saldo. Numeración correlativa automática.
- **Líneas** con nombre, descripción, cantidad (o etiqueta libre como
  «2 (sep / oct)»), precio unitario, descuento propio, marca de exento y de
  opcional (se ofrece aparte y no suma al total). Se reordenan arrastrando.
- **Banco de ítems y servicios prefijados**: cualquier línea se guarda en el
  catálogo propio con un clic y vuelve a cualquier otra cotización.
- **Catálogo del sistema**: se cotizan productos de la app **Productos** (con
  el recargo de cada opción deducido de sus variantes) y productos
  configurables de **ProductLab**, eligiendo su combinación de pasos y valores
  en un configurador que muestra el precio resultante en vivo. El precio y la
  combinación quedan **congelados** en la línea —una cotización es una oferta
  con fecha— y se actualizan solo si se pide (⟳ en la fila).
- **Clientes** traídos del directorio de la app **Clientes**, sin retipear la
  ficha.
- **Editor visual**: además del formulario, cada cotización tiene un lienzo
  de bloques sobre una cuadrícula de 12 columnas —cabecera, tabla de ítems,
  totales, notas, datos de pago, textos libres, imágenes, separadores, aire y
  saltos de página— que se arrastran para reordenar y se estiran para cambiar
  su ancho. Los bloques de datos **no copian nada**: leen del documento, así
  que editar una línea en Datos cambia lo que pinta el lienzo.
- **Cotizaciones tipo** reutilizables, una de ellas marcable como
  **predeterminada** (la usa «Nueva cotización» sin preguntar), y
  **duplicación** de cualquier cotización ya hecha para modificarla sin tocar
  la original. El diálogo de creación deja elegir el punto de partida: en
  blanco, desde una plantilla o replicando una cotización reciente.
- **Revisiones**: cuando el cliente pide cambios sobre una cotización ya
  enviada, no se reescribe la que salió —fuera hay una copia con ese número y
  esos precios—: se emite una revisión con el mismo número y sufijo `-R2`,
  enlazada con la anterior, que queda marcada como sustituida. Las revisiones
  no consumen correlativo.
- **Exportación a PDF** fiel al editor: la ventana de impresión renderiza la
  **misma hoja con los mismos componentes** del lienzo, así que lo que se ve
  en Diseño es lo que sale impreso. Tamaño de papel y márgenes configurables,
  bloques que no se parten entre páginas, cabecera de tabla repetida y saltos
  de página explícitos. El papel sale blanco aunque KIMOS esté en modo noche.
- **Enlace público** de la propuesta: se sube a Archivos como página HTML
  autocontenida (con el CSS embebido, para que lo enviado no cambie de
  aspecto cuando la app suba de versión) y devuelve una URL que se puede
  mandar al cliente sin adjuntar nada.
- **Envío por correo** con el SMTP del tenant
  (`POST /api/integrations/email/send`), desde **plantillas de correo
  editables** con variables (`{{cliente}}`, `{{numero}}`, `{{total}}`,
  `{{validez}}`, `{{firma}}`…), destinatarios, copia, copia oculta,
  responder-a y previsualización de cómo lo verá el cliente. El envío queda
  registrado en el historial y pasa la cotización a *Enviada*.
- **Historial de versiones** del cotizador completo por el menú 🗂️ Documentos
  del shell (Guardar versión · Restaurar).
- **Estados y seguimiento**: borrador · enviada · aceptada · rechazada, con
  vencimiento automático de las enviadas y bitácora por cotización.
- **Emisor y reglas** configurables: razón social, RUT, logo, datos de
  transferencia, moneda, si los precios se escriben netos o con impuesto
  incluido, impuesto, vigencia por defecto, reparto abono/saldo, formato del
  correlativo y notas que arrastra cada cotización nueva.
- **Colaboración multiusuario** sin pérdidas (APP-SPEC §5.1): fusión por
  línea, lápidas para las bajas, leer-fusionar-escribir y auto-reparación.

## Cómo se usa

1. **Ajustes** → completa el emisor (razón social, RUT, logo, datos de
   transferencia) y las reglas (moneda, impuesto, vigencia, abono).
2. **Cotizaciones** → *Nueva cotización*. Rellena cliente y asunto, añade
   líneas y ajusta los totales en el panel de la derecha.
3. Para líneas de catálogo usa **📦 Del catálogo** (tu banco de ítems) o
   **🛒 Del sistema** (Productos y ProductLab). Guarda una línea recurrente en
   el catálogo con el 📦 de su fila, o la cotización completa como
   **cotización tipo** para reutilizarla.
4. En **🎨 Diseño** compón la propuesta: añade bloques, arrástralos, cámbiales
   el ancho tirando del borde derecho y ajusta cada uno en el panel de la
   derecha. Es la maqueta que se exportará a PDF.
5. **👁 Vista previa** muestra la propuesta como se imprimirá, y desde ahí se
   exporta a PDF o se publica su enlace.
6. **✉ Enviar** manda la propuesta por correo con la plantilla que elijas.
7. Cambia el estado a **Enviada** cuando salga; la app la marcará **Vencida**
   sola al pasar su vigencia.

## El adjunto: qué se puede y qué no

El PDF lo genera el **diálogo de impresión del navegador** y lo guarda la
persona en su disco: la página nunca recibe ese archivo, así que la app **no
puede adjuntarlo sola**. Por eso el envío ofrece tres caminos, en orden de
comodidad:

1. **Enlace** a la propuesta publicada — siempre funciona, no pesa, y el
   cliente la ve tal cual en su navegador.
2. **La propuesta como HTML** autocontenido, generada y adjuntada con un clic.
3. **El PDF**: se exporta primero (👁 Vista previa → Exportar PDF), se guarda,
   y se adjunta con «Añadir archivo».

Un PDF adjunto automáticamente exigiría renderizarlo en el servidor (Chromium
headless o WeasyPrint en `kimos-enterprice`), que es una dependencia bastante
mayor que lo que resuelve.

## Estructura del proyecto

```
apps/cotizaciones/
├─ manifest.json          contrato de la app (versión: fuente de verdad)
├─ src/*.js               fuentes por responsabilidad (NO son módulos ESM)
├─ tools/build.mjs        concatena src/ → dist/index.js
├─ test/test-app.mjs      banco de pruebas (shell y React simulados)
├─ dist/index.js          bundle generado — no editar a mano
└─ dist/index.css         sistema visual sobre los tokens del tema
```

Las fuentes se compilan y se prueban con:

```bash
cd apps/cotizaciones
node tools/build.mjs      # regenera dist/index.js e inyecta APP_VERSION
node test/test-app.mjs    # 204 pruebas: cálculo, modelo, catálogo, lienzo, PDF, correo y render
```

`tools/build.mjs` toma la versión de `manifest.json`, así que `APP_VERSION`
nunca queda desalineada. El resto de los lugares donde vive la versión
(catálogo raíz y este README) los verifica `node tools/check-versions.mjs
cotizaciones` desde la raíz del repo.

## Modelo de datos

Todo vive como items de la instancia (`shell.items`), distinguidos por `kind`:

| `kind` | Qué es |
|---|---|
| `definition` | Ajustes del cotizador: emisor, reglas, correlativo. Item único. |
| `quote` | Una cotización. |
| `template` | Una cotización tipo, reutilizable (misma forma que `quote`). |
| `catalog` | Un ítem o servicio prefijado del banco propio. |
| `mail` | Una plantilla de correo. |

Los catálogos de otras apps NO se copian aquí: se leen con `shell.data`
(permisos `data.read:products`, `data.read:productlab`, `data.read:customers`)
y el RBAC del usuario es siempre el techo. Lo único que se guarda en la línea
es el precio, la descripción y la combinación elegida **en el momento de
cotizar**.

Una cotización guarda **su propia** moneda e impuesto al crearse: subir el IVA
en Ajustes no reescribe lo que se cotizó el año pasado.

## Historial de versiones

| Versión | Qué trae |
|---|---|
| 1.0.0 | Primera versión: cotizaciones con líneas, cliente, vigencia y estados; motor de totales (descuentos, exentos, opcionales, abono/saldo, precios netos o con impuesto incluido); numeración correlativa; cotizaciones tipo (con predeterminada), duplicación y revisiones enlazadas; banco de ítems prefijados; catálogo conectado a Productos, ProductLab y Clientes; editor visual de bloques en cuadrícula; exportación a PDF y enlace público; envío por correo con plantillas y variables; ajustes de emisor y reglas; colaboración multiusuario sin pérdidas. |
