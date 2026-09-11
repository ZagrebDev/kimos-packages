# Gestor de Proyectos (Kimos Project Manager) 🧭

App instalable de KIMOS para **dirigir proyectos de punta a punta, separados por
cliente**: planificar, ejecutar, controlar y cerrar, con un tablero global de la
cartera en la portada y un tablero propio dentro de cada proyecto.

**Versión actual: 1.6.0**

---

## Qué resuelve

| Necesidad | Cómo la cubre |
|---|---|
| Ver la cartera completa de un vistazo | Portada con avance global ponderado, salud de cada proyecto, hitos de los próximos 60 días, alertas y actividad reciente. Todo se recalcula solo. |
| Separar el trabajo por cliente | Los proyectos cuelgan de un cliente. Cada cliente muestra su número de proyectos, su avance medio y sus alertas. |
| Planificar de verdad | Fases, tareas con responsable, fechas, peso y entregable, hitos y línea temporal con la marca de hoy y las ventanas bloqueadas. |
| Controlar el avance | Avance real **contra el esperado a hoy**: la desviación es el número que dice si el proyecto va bien, no la sensación. |
| Gestionar el riesgo | Matriz 5×5 de probabilidad × impacto, con severidad, mitigación, responsable y estado. |
| Trabajar con la documentación | Biblioteca de imágenes, videos, PDF, planos y planillas, alimentada desde el disco, desde una carpeta conectada, desde Google Drive o desde cualquier enlace. |
| Proponer el plan de trabajo | El **analista** lee esa documentación y arma fases, tareas fechadas, hitos, riesgos típicos y el checklist de lo que falta. |
| Dejar memoria del proyecto | Bitácora de decisiones, reuniones, problemas e hitos; consultas abiertas con el cliente. |
| Saber cuánto cuesta y a qué precio se oferta | Economía completa: CAPEX y OPEX separados, partidas por centro y por moneda, línea base con el puente que explica cada desvío, modelo de costeo del servicio y margen recomendado. |
| Responder preguntas sobre el proyecto | El analista contesta con los números del proyecto: de dónde sale cada cifra, qué significa y qué conviene hacer. |

## Pestañas

**Cartera** — `Panel` · `Clientes` · `Proyectos`
**Dentro de un proyecto** — `Resumen` · `Plan` · `Riesgos` · `Documentos` · `Economía` · `Analista` · `Bitácora` · `Ficha`

## Economía: del costo al precio

La pestaña **Economía** tiene cuatro bloques:

**Costeo.** Partidas separadas en **CAPEX** (inversión: cantidad × costo unitario)
y **OPEX** (servicio recurrente: costo mensual × meses), cada una con su categoría
y su centro. Un stock y un flujo nunca se suman a ciegas. Con una **línea base**
fijada, el **puente** muestra partida por partida qué bajó, qué subió y por qué el
total terminó donde terminó.

**Centros y monedas.** El proyecto se gestiona en una moneda, pero la oferta se
firma por sede: cada centro declara su moneda local y sus equipos, y las partidas
compartidas se prorratean por unidades, por costo directo o en partes iguales.

El **conversor** mantiene una sola tabla de tipos de cambio por proyecto, con el
dólar como base, y de ahí sale cada conversión de la app. *Actualizar al valor de
hoy* consulta un proveedor público —con dos respaldos si el primero no
responde— y, si la política de red del host bloquea la consulta, lo dice y deja
el valor escrito a mano, que es el que firma la oferta de todas formas. El tipo
de cambio de cada centro se deriva de esa tabla salvo que se fije a mano. Todo
importe fuera del dólar lleva su equivalente en dólares en pequeño al lado, y al
cambiar la moneda de gestión la app pregunta si reexpresar los importes al nuevo
tipo de cambio o solo cambiar la etiqueta.

**Modelo de servicio.** Plazo, reajuste, horas de SLA y disponibilidad
comprometida, más los supuestos de costo del servicio. Con eso la app construye
tres escenarios de abajo hacia arriba —cuadrilla propia, híbrido y
subcontratado—, los compara con el fee cargado y calcula la **aritmética del
SLA**: cuánta caída permite la disponibilidad prometida y si el tiempo de
resolución comprometido cabe dentro de ese margen, por equipo y sobre la flota.

**Precio final.** Un motor de margen propone el porcentaje a partir de la
envergadura y de los riesgos que el propio proyecto declara —tipo de contrato,
exposición cambiaria, multas, plazo, riesgos críticos abiertos—, con cada sumando
a la vista. El precio se calcula por separado para la inversión y el servicio, y
se presenta en la moneda de cada centro.

Cuando el costeo supera el presupuesto declarado por encima del umbral
configurado, el indicador se marca en rojo en la ficha, en el tablero del
proyecto y en el panel global.

## El analista

Lee los nombres y tipos de los documentos indexados, las carpetas conectadas, el
objetivo, el alcance y las etiquetas; deduce de qué tipo de trabajo se trata y
propone un plan completo. Es **determinista y explicable**: cada propuesta viene
con la evidencia que la produjo, y **nada se aplica hasta que la persona lo
aprueba** (añadir al plan actual o reemplazarlo).

Plantillas incluidas: licitación o propuesta formal, implementación en terreno,
desarrollo de software, estudio o consultoría, campaña comercial y proyecto
general en cinco fases. Las fechas evitan fines de semana y las **ventanas
bloqueadas** que declares en la ficha del proyecto (por ejemplo, un mes en que el
cliente no permite trabajos).

### Modo preguntas

El segundo modo del analista responde preguntas sobre el proyecto **con los
números del proyecto**. Ocho análisis, cada uno con sus tablas, sus gráficos y su
conclusión:

| Análisis | Responde a |
|---|---|
| Presupuesto vs. costeo por líneas | «¿Explícame la diferencia entre el presupuesto y el costeo?» — qué es cada cifra, y el puente partida por partida contra la línea base. |
| CAPEX, OPEX y modelo de servicio | «¿Explícame el OPEX y el CAPEX?» — por qué no se suman, por qué el chequeo del % anual engaña, la densidad frente al SLA y los tres escenarios de costo. |
| Aritmética del SLA | «¿El SLA que nos piden es alcanzable?» — caída permitida contra tiempo de resolución, por equipo y por flota, y las multas en perspectiva. |
| Precio final, margen y monedas | «¿Cuánto deberíamos ofertar?» — costo, margen razonado y precio por centro en su moneda. |
| Estado del proyecto | «¿Cómo va?» — avance real contra esperado, lo atrasado y el próximo hito. |
| Riesgos y qué negociar | «¿Qué debo cerrar antes de firmar?» |
| Plazo, hitos y ventanas bloqueadas | «¿Llegamos con el plazo?» |
| Documentación disponible y faltante | «¿Qué tenemos y qué falta?» |

Ninguna respuesta se inventa: cada cifra sale de las partidas, las tareas, los
riesgos o los parámetros del modelo de servicio, y las conclusiones son reglas
explícitas sobre esas cifras. Si un dato no está cargado, la respuesta lo dice en
vez de rellenarlo. El agente IA de KIMOS usa la misma máquina con la herramienta
`ASK`, de modo que por chat se obtiene exactamente el mismo análisis.

## Documentos y carpetas

Los archivos **no se copian al servidor**. La app indexa la ficha de cada uno
—nombre, tipo, tamaño, ruta y carpeta de origen— y guarda una miniatura de las
imágenes. Así la biblioteca sirve para trabajar sin convertir el documento de la
instancia en un depósito de binarios.

| Origen | Cómo |
|---|---|
| Archivos sueltos | Botón *Subir archivos* o arrastrarlos sobre la zona de la pestaña Documentos. |
| Carpeta del disco (C:\ u otra) | *Conectar carpeta*. Con la File System Access API queda un enlace vivo re-sincronizable con *volver a leer*; sin ella, el navegador entrega el contenido una vez. |
| Google Drive, OneDrive, Dropbox o cualquier enlace | *Drive / nube*: se registra la fuente con su enlace y, si pegas el listado de archivos, cada línea se convierte en una ficha de documento. |

## Clientes unificados con el directorio de KIMOS

La app **Clientes** de KIMOS es el registro de origen de la ficha de cada
cliente. Esta app no lo duplica: lo lee con `shell.data` —permiso
`data.read:customers`— y guarda en cada cliente de la cartera un enlace a su
ficha original.

Los campos que comparten ambas apps se llaman igual (`name`, `email`, `phone`,
`city`, `region`, `country`, `customerSince`), así que sincronizar es copiar
campo a campo, sin traducción. Lo que es propio de la gestión de proyectos
—código, rubro, color en los gráficos, contraparte y notas del equipo— nunca se
pisa, porque el directorio no lo conoce.

| Acción | Dónde |
|---|---|
| Ver el directorio y traer fichas | Clientes → *Traer del directorio* |
| Evitar duplicados | Al traer una ficha se **vincula** en vez de crear otra, por identidad del sistema, RUT, correo o nombre, en ese orden |
| Actualizar los vinculados | Clientes → *Sincronizar* (informa qué cambió y qué enlaces quedaron huérfanos) |
| Vincular o desvincular una ficha suelta | Editor del cliente |

### La identidad, además del enlace (desde 1.4)

El enlace al directorio dice *de qué ficha salió* este cliente. La **identidad
del sistema** dice algo distinto y más fuerte: *quién es*.

```
client.link      → la ficha de origen en una instancia de Clientes
client.recordRef → kimos:record/account/…  la identidad, compartida por TODAS las apps
```

Por qué importa: vincular por correo o por nombre es lo que había y es lo que
falla. La misma empresa con dos correos son dos clientes; el mismo nombre
escrito de dos formas, también. La identidad de la plataforma
(`shell.records`, permiso `records.link`) normaliza las claves antes de
comparar —`77.718.188-2` y `777181882` son el mismo RUT— y, sobre todo,
permite cruzar apps: **el cliente de este proyecto es el mismo que el de esa
cotización**, y «dame todo lo de Acme» incluye sus proyectos.

En la ficha del cliente aparece su estado —*Cliente del sistema* o *Solo en
esta cartera*— con el botón para vincularla o refrescarla. Se muestra siempre,
también cuando no hay identidad: una ficha suelta es legítima, pero conviene
verlo, porque es la situación que produce el duplicado meses después.

Tres detalles que evitan sorpresas:

- Se guarda la referencia **y** la copia de los campos. Si la identidad se
  renombra o desaparece, la cartera sigue mostrando lo que tenía; refrescar es
  un acto explícito.
- Si dos identidades se fusionan, al refrescar la cartera se reapunta a la
  correcta.
- `shell.records` es opcional en el contrato: en un host que no lo exponga, la
  app funciona igual que la 1.3 y lo dice.

La lectura entre apps es de una sola dirección: lo que se corrija aquí no viaja
de vuelta al directorio, y la app lo dice donde corresponde en vez de simular una
sincronización que el contrato no permite. Si el host no expone `shell.data` o no
hay instancias visibles de Clientes, la cartera sigue funcionando con sus fichas
locales y el aviso explica por qué.

## Ecosistema KIMOS

Con el permiso `data.read:*` de cada template, la ficha del proyecto lista las
instancias visibles de **Planificación**, **Kanban** y **Cotizaciones** del mismo
espacio de trabajo y permite enlazarlas al proyecto, de modo que la cartera sepa
qué tablero, qué plan y qué cotización corresponden a cada trabajo.

## Primer proyecto incluido

Al abrirse por primera vez, la app se siembra con el cliente **Parque Arauco** y
su proyecto **Licitación Directorios Digitales PAK y PLC** (proceso
PA-128-2026-DCL), cargado desde el informe consolidado del proceso: 8 fases, 31
tareas, 9 hitos, 13 riesgos priorizados, 11 documentos, 10 consultas abiertas y
la ventana bloqueada de diciembre en Kennedy. En economía trae los dos centros
—Kennedy en CLP y La Colina en COP—, las 15 partidas del costeo v2 separadas en
CAPEX y OPEX, la línea base de 9 partidas del análisis interno previo y el modelo
de servicio con sus tres niveles de SLA y sus multas. Sirve de proyecto real y de
ejemplo completo de lo que la app sabe llevar.

## Control por agente IA

`shell.agent.register` con paridad sobre la interfaz:

`CREATE_CLIENT` · `CREATE_PROJECT` · `UPDATE_PROJECT` · `ADD_TASK` ·
`UPDATE_TASK` · `ADD_MILESTONE` · `ADD_RISK` · `UPDATE_RISK` · `ADD_DOCUMENT` ·
`ADD_LOG` · `PROPOSE_PLAN` · `APPLY_PLAN` · `OPEN_VIEW` · **`ASK`** ·
`ADD_BUDGET_LINE` · `ADD_CENTER` · `UPDATE_COSTING` · `SET_BASELINE` ·
`UPDATE_FX` · `LIST_DIRECTORY_CLIENTS` · `IMPORT_CLIENTS` · `LINK_CLIENT` ·
`SYNC_CLIENTS`

`getSnapshot()` devuelve la cartera completa con métricas por proyecto, tareas,
riesgos y fuentes, para que el agente sepa sobre qué actuar antes de despachar.

## Datos y colaboración

- Un documento JSON por instancia vía `shell.saveData()` / `loadData()`, con
  guardado *debounced* y sincronización periódica.
- **Fusión por entidad** (§5.1 del `APP-SPEC.md`): cada cliente, proyecto, tarea,
  riesgo y documento lleva su `updatedAt` y gana la edición más reciente; las
  bajas viajan como lápidas para que lo borrado no reaparezca desde la pantalla
  de otra persona. Dos personas pueden trabajar a la vez sin pisarse.

## Preferencias (⚙️ Configurar)

Color de acento · moneda por defecto · días de anticipación para las alertas ·
umbral de desvío del costeo · **destino por defecto de los archivos** · **tamaño
máximo por archivo** · tablas compactas · mostrar u ocultar las cifras de
presupuesto.

## Aspecto

Toda la paleta de interfaz sale de los tokens del tema del host: la app cambia de
día/noche y de color de acento junto con KIMOS. Las únicas excepciones
documentadas son los colores de serie de los gráficos y los de estado, que usan
una paleta categórica validada (separación bajo daltonismo ΔE ≥ 8 y piso de
visión normal ΔE ≥ 15 en ambos modos), con su juego de pasos para fondo oscuro.

## Historial de versiones

| Versión | Qué trae |
|---|---|
| **1.6.0** | El destino público pasa a usar la **API oficial `shell.files`** (§7.e del APP-SPEC, permiso `files.write`): la ruta la decide el host, con aislamiento por app, cuota atribuible y limpieza al desinstalar. El área privada del equipo sigue por el endpoint directo, porque `shell.files` entrega URLs de lectura pública por diseño y la documentación confidencial no puede vivir ahí. Un único criterio decide si un documento está en el almacenamiento, venga por donde venga. |
| **1.5.0** | **Los archivos se suben al Cloud Storage del tenant** (`POST /api/v2/files`), con dos destinos: el área privada del equipo —la de por defecto, para documentación confidencial— y el enlace público, que solo se usa cuando la persona lo elige y con el aviso de que se sirve sin autenticación. Progreso de subida, apertura con credenciales de los archivos privados, reintento desde la ficha del documento y subida de una carpeta conectada completa. Lo que no se puede subir queda indexado igual, con el error del backend a la vista. Corregido: la miniatura de una imagen ya no puede dejar colgada la carga de un archivo (ahora tiene tiempo límite). |
| **1.4.0** | **Identidad del cliente compartida con todo KIMOS**: además del enlace a su ficha de origen, cada cliente guarda su `recordRef` (`shell.records`, permiso `records.link`), así que el cliente de un proyecto es el mismo que el de una cotización. Al traer del directorio se reconoce primero por identidad y por RUT —que se normaliza— antes que por correo o nombre, que es lo frágil. Se añade **RUT** a la ficha, el estado de la identidad con su acción en el editor del cliente, y dos herramientas de agente: `LINK_CLIENT_IDENTITY` y `REFRESH_CLIENT_IDENTITY`. En un host sin `shell.records` la app funciona igual que la 1.3. |
| **1.3.0** | **Clientes unificados con la app Clientes de KIMOS**: la ficha de la cartera comparte los nombres de campo del directorio, se trae desde él con enlace a su registro de origen, se vincula en vez de duplicarse cuando ya existe un cliente con el mismo correo o nombre, y se re-sincroniza informando qué campos cambiaron y qué enlaces quedaron huérfanos. Nuevo permiso `data.read:customers` y cuatro herramientas de agente para operar el directorio. Las fichas escritas antes de la unificación migran solas: el correo y el teléfono de contacto pasan a los campos compartidos. |
| **1.2.0** | **Conversor de moneda**: una tabla de tipos de cambio por proyecto con el dólar como base, actualizable con el valor del día desde tres proveedores públicos encadenados y editable a mano cuando la red del host no deja consultar. El tipo de cambio de cada centro se deriva de la tabla o se fija a mano; cada importe fuera del dólar muestra su equivalente en pequeño; y al cambiar la moneda de gestión la app ofrece reexpresar los importes o solo cambiar la etiqueta. Las cantidades y los costos unitarios ahora se escriben y se leen con **separador de miles**, con el valor crudo al enfocar el campo. Nueva herramienta de agente `UPDATE_FX`. Corregido: las bandas del margen recomendado se miden en dólares, así que ya no dependen de la moneda en que esté expresado el proyecto. |
| **1.1.0** | Pestaña **Economía**: costeo separado en CAPEX y OPEX, partidas por centro y por moneda con prorrateo de lo compartido, línea base y puente que explica cada desvío, modelo de costeo del servicio post-venta con tres escenarios y aritmética del SLA, y motor de margen que lleva del costo al precio ofertable en la moneda de cada sede. El indicador de presupuesto se marca en rojo cuando el costeo lo supera por encima del umbral configurado, en la ficha, en el tablero del proyecto y en el panel global. **Modo preguntas del analista** con ocho análisis que responden con los números del proyecto, disponibles también para el agente IA con la herramienta `ASK`. Cinco herramientas nuevas de agente para la economía. El proyecto semilla de Parque Arauco trae sus centros, su línea base y su modelo de servicio. |
| **1.0.0** | Primera publicación. Cartera por cliente; tablero global y por proyecto en vivo; plan con fases, tareas, hitos y línea temporal; matriz de riesgos 5×5; biblioteca de documentos con carpetas locales, Drive y enlaces; analista que propone planes de trabajo con seis plantillas; bitácora; costeo por partidas; consultas abiertas; ventanas bloqueadas; enlace con Planificación, Kanban y Cotizaciones; agente IA con 13 herramientas; colaboración multiusuario con fusión por entidad; proyecto semilla de Parque Arauco. |

## Lo que otra app NO puede hacer aquí, y por qué

Esta app **no publica `dataSchema`**, así que ninguna otra puede escribir en
ella. No es una decisión de diseño sino una consecuencia de cómo guarda: el
modelo completo vive en un solo documento (`shell.saveData`), y la pasarela de
escritura entre apps opera sobre `shell.items`, no sobre ese documento.
Publicar un contrato sería prometer una puerta que no existe.

Si en el futuro conviene que Cotizaciones pueda abrir un proyecto al aceptarse
una propuesta, el orden es: primero mover proyectos y clientes a
`shell.items`, y el `dataSchema` después. Al revés no funciona.

La dirección que **sí** existe ya está usada: esta app lee el directorio de
Clientes (`data.read:customers`) y comparte la identidad del cliente con todo
KIMOS (`records.link`).
