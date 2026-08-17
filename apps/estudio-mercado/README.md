# Estudio de Mercado 🎯

App instalable de KIMOS con el **estudio del mercado competitivo**: cuánto cobra
la competencia por lo mismo que hace cada módulo de KIMOS, qué precio se sugiere
en consecuencia, cuánto mercado hay país por país y qué economía por cliente
resulta de todo eso.

**Versión actual: 1.1.0**

La app no es un informe congelado: es el modelo. Todos los supuestos son
editables y las 154 filas de precios se recalculan en vivo, así que una
pregunta como *"¿y si cobramos 0,85 en vez de 0,55, con 25 usuarios?"* se
responde en la pantalla en vez de rehacer la planilla.

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
| **Diagnóstico** | Ocho dimensiones evaluadas de 0 a 10, ocho movimientos concretos, las ocho decisiones que cruzan oferta y demanda, la matriz de cartera, la conclusión y las advertencias metodológicas. |

## Aspecto

Adopta el sistema visual del dashboard del estudio: fondo cosmos con auroras
violeta/cian/fucsia, superficies de vidrio, KPIs con acento por color y gráficos
en SVG dibujados por la propia app (sin librerías ni CDN: el bundle carga sin
red). La paleta de acentos es fija porque **los colores son datos** — cada serie,
cuadrante y estado tiene el suyo. El botón *Tema* alterna entre ese tema de
estudio y el tema del escritorio de KIMOS, que reencaja las superficies sobre
los tokens del shell y sigue su día/noche.

## De dónde salen los datos

Del estudio levantado el **16-ago-2026** (planilla `KIMOS_Estudio_Mercado_Pricing.xlsx`
y dashboard HTML): 154 precios de lista públicos, 140 de ellos verificados en
fuente, y el estudio de demanda con 30 mercados. `src/extraer-planilla.py`
convierte el libro Excel en `src/data.json` (y restaura las tildes que la
planilla original no traía); `src/visual.json` guarda el sistema visual —iconos,
diagnóstico, sugerencias y textos— tomado del dashboard HTML del estudio, y
`build.mjs` incrusta ambos en el bundle.

Las fórmulas de la planilla están reimplementadas en JavaScript, no copiadas
como resultados: normalización al cliente tipo, mediana excluyendo planes
Enterprise, precio sugerido = mediana × factor, embudo TAM/SAM, índice
ponderado por SAM y cohortes con supervivencia. `test/smoke.mjs` verifica que
reproduzcan las cifras del estudio original ($777/mes el Enterprise, $2.767 el
stack actual, $2.939 MM de SAM, índice 0,91, 364 clientes vivos al año 3).

## Control por agente IA

Registra ocho herramientas: `SET_SUPUESTO`, `SET_DESCUENTO_PLAN`,
`SET_PRECIO_COMPETIDOR`, `COTIZAR`, `SET_ALCANCE`, `VER_PESTANA`, `VER_MODULO` y
`RESTAURAR_SUPUESTOS`. El snapshot se recalcula al
vuelo desde el estado actual, así que el agente responde con las cifras vigentes
—no con las del último render— y puede contestar cosas como *"¿cuánto sube la
lista si el factor pasa a 0,85 y el alcance es solo Norteamérica?"*.

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
| 1.1.0 | Tablero interactivo con el sistema visual del dashboard del estudio: cinco KPIs de cabecera, gráficos en SVG (barras comparadas, dona del stack, escalera de planes, SAM y precio por país, ARR y matriz de cartera), pestañas nuevas de **Configurador** (cotización en vivo con presets y veredicto de banda), **Pros y contras** (tarjeta por módulo con icono) y **Diagnóstico** (ocho dimensiones, ocho movimientos y conclusión), precios de la competencia editables fila por fila, controles del cliente tipo con sliders, tarjetas de plan y alternador de tema estudio/KIMOS. |
| 1.0.0 | Primera versión: 24 módulos contra 154 planes de la competencia, planes y kits con descuento editable, chequeo contra el stack actual, 30 mercados filtrables con precio por país, unit economics con proyección a 3 años, perfiles de cliente, evidencia de demanda, ocho decisiones cruzadas y matriz de cartera. Supuestos editables con persistencia por instancia, exportación a CSV y control por agente. |
