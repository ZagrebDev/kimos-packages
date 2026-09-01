# Estudio de Mercado 🎯

App instalable de KIMOS que hace **estudios de mercado competitivo**: cuánto
cobra la competencia por lo mismo que hace cada línea de producto, qué precio se
sugiere en consecuencia, cuánto mercado hay país por país y qué economía por
cliente resulta de todo eso.

**Versión actual: 2.0.0**

Trae hecho el estudio de KIMOS —25 líneas contra 170 planes de precio de la
competencia— y sirve para hacer el de **cualquier otra empresa**: se elige la
plantilla del rubro, se cargan las líneas y los precios con su fuente, y el
mismo motor devuelve precio sugerido, mercado y unit economics. Ese es el
producto de suscripción: el modelo, no el informe.

La app no es un informe congelado. Todos los supuestos son editables y las filas
de precios se recalculan en vivo, así que una pregunta como *"¿y si cobramos
0,85 en vez de 0,55, con 25 usuarios?"* se responde en la pantalla en vez de
rehacer la planilla.

## Qué trae

| Pestaña | Qué responde |
|---|---|
| **Resumen** | Los cinco KPIs del negocio, el gráfico de precio sugerido contra la mediana del mercado, la dona del gasto que KIMOS reemplaza, la escalera de planes y el estudio en seis frases. |
| **Mapa competitivo** | Los 24 módulos contra su categoría de mercado: mínimo, mediana y máximo, precio sugerido, ahorro y cuadrante de cartera. Al hacer clic se abre el detalle con los planes de cada competidor, los argumentos a favor y en contra, y la estrategia. |
| **Precios por app** | Los 154 planes levantados, filtrables y con fuente por fila. Los cuatro controles del cliente tipo (usuarios, canales, factor y descuento anual) y **cada precio de la competencia son editables**: al cambiarlos se recalcula el modelo entero. |
| **Planes y kits** | Tarjetas de plan con precio, por usuario y anual, descuento de bundle editable, kits por necesidad y el chequeo contra el stack best-of-breed equivalente. |
| **Configurador** | Marca los módulos que necesita un cliente y obtén la cotización al instante, con el equivalente de mercado, el ahorro anual y el veredicto de banda sana. Trae los planes y kits como presets. |
| **Mercados** | 30 mercados con filtros de región, país, idioma y prioridad comercial: TAM, SAM, índice de precio ponderado y precio recomendado por país para cada plan. |
| **Economía** | ARPU, LTV, CAC, LTV:CAC, payback y proyección de ARR a 3 años por cohortes, con la supervivencia mes a mes que impone el churn. |
| **Clientes** | Los seis perfiles de cliente ideal, la segmentación por tamaño y la evidencia de demanda con su fuente. |
| **Pros y contras** | Una tarjeta por módulo con lo que KIMOS tiene a favor y en contra frente a la competencia real de esa categoría. Donde la posición es mala, lo dice. |
| **Diagnóstico** | Ocho dimensiones evaluadas de 0 a 10, la concentración del valor por módulo, ocho movimientos concretos, las ocho decisiones que cruzan oferta y demanda, la matriz de cartera, la conclusión y las advertencias metodológicas. |
| **Este estudio** | La identidad del estudio (empresa, rubro, moneda, fecha, autor), el estado de la evidencia con alerta de vencimiento, las nueve plantillas de rubro para empezar el estudio de otra empresa, importar y exportar el estudio como JSON, los editores de líneas y de precios, y el protocolo de investigación en nueve pasos. |

## Aspecto: tres modos, un solo tablero

El menú de la cabecera ofrece tres modos visuales. Los tres comparten el mismo
DOM y los mismos datos: lo que cambia son las métricas (tipografía, paddings,
radios) y, en el caso del dashboard, el formato numérico.

| Modo | Para qué |
|---|---|
| **Modo dashboard** (por defecto) | Réplica del tablero HTML del estudio: fondo cosmos con auroras violeta/cian/fucsia, cabecera con marca y herramientas, KPIs con acento por color, pestañas en panel adherido, tarjetas de vidrio y el formato numérico del tablero (`$2,767`). |
| **Modo compacto** | Lo mismo con menos aire, para ventanas chicas del escritorio. Formato local (`$2.767`). |
| **Modo KIMOS** | Reencaja las superficies sobre los tokens del shell y sigue el día/noche y el acento del escritorio. |

La paleta de acentos es fija en los tres porque **los colores son datos**: cada
serie, cuadrante y estado tiene el suyo. Los gráficos se dibujan en SVG dentro
del propio bundle, sin librerías ni CDN, así que la app carga sin red.

**Adaptable de bolsillo a tótem.** La escala vive en variables y se ajusta por
tamaño de pantalla: móvil (una columna, pestañas deslizables, KPIs apilados),
tablet (cotización bajo el configurador), PC, y monitores de 1800 px o más
—tótems incluidos— donde tipografía, KPIs y controles crecen para leerse de pie.
En pantallas táctiles los objetivos de toque se agrandan, y hay hoja de estilo
de impresión para sacar el tablero en PDF.

## Un estudio por empresa

Desde la 2.0.0 el estudio dejó de ser la app y pasó a ser un **documento**: vive
en la instancia, se edita, se exporta y se importa. El de KIMOS es la semilla
con la que abre una ventana nueva; como la app es multiinstancia, dos ventanas
pueden estar analizando dos empresas distintas al mismo tiempo.

| Pieza | Qué resuelve |
|---|---|
| **Nueve plantillas de rubro** | Software B2B, comercio y e-commerce, servicios profesionales, salud, educación, manufactura, hotelería y turismo, logística, y una en blanco. Una plantilla trae la estructura de comparación del sector y **de dónde se sacan los datos ahí** —en software una página de precios, en salud un arancel, en industria un catálogo del canal—, nunca cifras. |
| **Fuente obligatoria** | Un precio sin fuente no se puede cargar, ni desde el formulario ni desde el agente. *Verificado* es solo el precio publicado por el proveedor; lo que se reconstruye desde contratos reportados por terceros es *Estimado* y lleva el rango en la nota. |
| **Control de vigencia** | La app calcula la edad del levantamiento y avisa: a los seis meses toca revisarlo, a los doce ya no sirve para decidir. También lista los huecos concretos (líneas sin competencia, precios sin fuente, mercados vacíos). |
| **Importar y exportar** | El estudio completo es un JSON: se versiona, se le entrega al cliente y se vuelve a cargar en cualquier ventana. Al importar se valida la estructura y, si falta algo, dice exactamente qué. |
| **Protocolo de investigación** | Los nueve pasos del método con que se levantó el de KIMOS —cliente tipo, categoría por línea, precio de lista primero, estimar y declararlo, excluir Enterprise de la mediana, mediana × factor, demanda con dos fuentes, cerrar con unit economics, fechar y volver a levantar—, a la vista en pantalla y disponible para el agente. |

## De dónde salen los datos

El estudio semilla se levantó el **16-ago-2026** (planilla
`KIMOS_Estudio_Mercado_Pricing.xlsx` y dashboard HTML): 154 precios de lista
públicos, 140 de ellos verificados en fuente, y el estudio de demanda con 30
mercados. `src/extraer-planilla.py` convierte el libro Excel en `src/data.json`
(y restaura las tildes que la planilla original no traía); `src/visual.json`
guarda el sistema visual —iconos, diagnóstico, sugerencias y textos— tomado del
dashboard HTML del estudio.

`src/ampliacion.json` es lo investigado **después** de la planilla, y se fusiona
en el build: el módulo 25, **Estudio de Mercado**, con los 16 planes de su propia
categoría —Crayon, Klue, AlphaSense, Contify, Kompyte, Statista, Similarweb,
Semrush, IBISWorld, Attest, Prisync, Visualping, SpyFu, Owler y SurveyMonkey—,
levantados el 1-sep-2026 con el mismo método: 9 con precio de lista público y 7
estimados desde contratos anuales reportados por terceros, porque en inteligencia
competitiva los proveedores grandes no publican tarifa. Mediana de la categoría
USD 317 al mes, precio sugerido USD 174. El archivo separado mantiene reproducible
el extractor de la planilla y deja a la vista de dónde salió cada fila.
`build.mjs` incrusta todo en el bundle.

Las fórmulas de la planilla están reimplementadas en JavaScript, no copiadas
como resultados: normalización al cliente tipo, mediana excluyendo planes
Enterprise, precio sugerido = mediana × factor, embudo TAM/SAM, índice
ponderado por SAM y cohortes con supervivencia. `test/smoke.mjs` verifica que
reproduzcan las cifras del estudio original ($777/mes el Enterprise, $2.767 el
stack actual, $2.939 MM de SAM, índice 0,91, 364 clientes vivos al año 3) y que
el mismo motor sirva para otra empresa: crea un estudio con la plantilla de
salud, comprueba que no trae ni un precio inventado, renderiza las once pestañas
con el estudio vacío, carga líneas y precios por el agente y hace el viaje de
ida y vuelta a JSON.

## Control por agente IA

Registra diecisiete herramientas. Nueve mueven el modelo: `SET_SUPUESTO`,
`SET_DESCUENTO_PLAN`, `SET_PRECIO_COMPETIDOR`, `COTIZAR`, `SET_ALCANCE`,
`VER_PESTANA`, `VER_MODULO`, `SET_TEMA` y `RESTAURAR_SUPUESTOS`. El snapshot se
recalcula al vuelo desde el estado actual, así que el agente responde con las
cifras vigentes —no con las del último render— y puede contestar cosas como
*"¿cuánto sube la lista si el factor pasa a 0,85 y el alcance es solo
Norteamérica?"*.

Las otras ocho le permiten **hacer el estudio entero**: `PROTOCOLO` (el método,
las fuentes que sirven en ese rubro y lo que al estudio le falta),
`NUEVO_ESTUDIO`, `SET_IDENTIDAD`, `AGREGAR_LINEA`, `AGREGAR_COMPETIDOR`
—rechaza cualquier precio sin fuente—, `ELIMINAR_COMPETIDOR`, `EXPORTAR_ESTUDIO`
e `IMPORTAR_ESTUDIO`. Con eso, *"hazme el estudio de mercado de una clínica
dental en Santiago"* es una secuencia de herramientas: crear con la plantilla de
salud, investigar los aranceles publicados, cargarlos con su fuente y leer el
precio sugerido, el mercado y la economía por paciente que devuelve el modelo.

## Desarrollo

```bash
node apps/estudio-mercado/build.mjs        # src/app.js + src/data.json → dist/index.js
node apps/estudio-mercado/test/smoke.mjs   # contrato, cifras y render de las 10 pestañas
node tools/check-versions.mjs estudio-mercado
node tools/pack.mjs apps/estudio-mercado   # .kapp para instalar desde archivo
```

Para actualizar los datos del estudio: regenerar `src/data.json` con
`src/extraer-planilla.py` sobre la planilla nueva y volver a construir.

## Historial

| Versión | Cambios |
|---|---|
| 2.0.0 | **El estudio deja de ser la app y pasa a ser un documento**, para que la herramienta sirva a cualquier empresa y no solo a KIMOS: nueve plantillas de rubro, editor de identidad, de líneas y de precios con fuente obligatoria, importar y exportar como JSON, control de vigencia de la evidencia con alerta a los 6 y 12 meses, y el protocolo de investigación en nueve pasos, todo en la pestaña nueva **Este estudio**. Ocho herramientas nuevas de agente (`PROTOCOLO`, `NUEVO_ESTUDIO`, `SET_IDENTIDAD`, `AGREGAR_LINEA`, `AGREGAR_COMPETIDOR`, `ELIMINAR_COMPETIDOR`, `EXPORTAR_ESTUDIO`, `IMPORTAR_ESTUDIO`) dejan el estudio completo al alcance del agente. Se investigó además la propia categoría de la app y entró como **módulo 25, Estudio de Mercado**, con 16 planes de competencia levantados el 1-sep-2026 (`src/ampliacion.json`): la suite a la carta pasa de $2.046 a $2.220 al mes y los precios verificados de 140/154 a 149/170. Cambia el formato de datos guardado y el contrato del agente, de ahí el salto de versión mayor. |
| 1.2.0 | **Modo dashboard**: réplica del tablero del estudio (cabecera con marca y herramientas, KPIs con acento por color, pestañas en panel adherido, formato numérico del tablero) elegible desde el menú de tema junto al modo compacto y el modo KIMOS. Tarjetas de plan con las filas del tablero (suma a la carta, descuento, anual, ahorro, módulos), gráfico de concentración del valor en Diagnóstico y botón Imprimir/PDF. Arregla dos fallos de la 1.1.0: la raíz ya no se posiciona en absoluto —lo que descuadraba las proporciones dentro de la ventana del shell— y los títulos ya no heredan colores del host, que los dejaba negros sobre el fondo oscuro. Adaptación explícita a móvil, tablet, PC y tótem. |
| 1.1.0 | Tablero interactivo con el sistema visual del dashboard del estudio: cinco KPIs de cabecera, gráficos en SVG (barras comparadas, dona del stack, escalera de planes, SAM y precio por país, ARR y matriz de cartera), pestañas nuevas de **Configurador** (cotización en vivo con presets y veredicto de banda), **Pros y contras** (tarjeta por módulo con icono) y **Diagnóstico** (ocho dimensiones, ocho movimientos y conclusión), precios de la competencia editables fila por fila, controles del cliente tipo con sliders, tarjetas de plan y alternador de tema estudio/KIMOS. |
| 1.0.0 | Primera versión: 24 módulos contra 154 planes de la competencia, planes y kits con descuento editable, chequeo contra el stack actual, 30 mercados filtrables con precio por país, unit economics con proyección a 3 años, perfiles de cliente, evidencia de demanda, ocho decisiones cruzadas y matriz de cartera. Supuestos editables con persistencia por instancia, exportación a CSV y control por agente. |
