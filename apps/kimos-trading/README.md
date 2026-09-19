# KIMOS Trading 📈

**Versión actual: 1.0.0**

Cabina de trading de criptomonedas con agentes, para Binance, con contabilidad
chilena. Tres motores independientes, un agente de riesgo con poder de veto, los
26 patrones de velas como reglas numéricas, backtesting con costos reales,
cascada de capital con marca de agua y libro tributario del SII.

---

## Lo primero, porque cambia cómo se lee todo lo demás

**Esta app no guarda claves de Binance y no puede enviar órdenes.** No hay
ningún campo donde pegar una API secret, y eso es una decisión, no una carencia:

- El bundle corre en el navegador. Lo que llega ahí llega a las herramientas de
  desarrollo, a una extensión y a un volcado de memoria.
- Binance restringe a **solo lectura** las claves HMAC sin lista blanca de IP, y
  exige restricción de IP o clave Ed25519 autogenerada para habilitar trading.
  Un navegador no tiene IP fija.

Quien ejecuta es **Geminis Core**, el motor que viaja en [`assets/engine/`](assets/engine/)
y se instala en un VPS con IP fija. Él tiene las claves, él firma, él coloca los
OCO en el exchange.

```
   KIMOS Trading (navegador)              Geminis Core (VPS, IP fija)
   ───────────────────────────            ───────────────────────────
   política, límites, aprobaciones  ──►   GET  /api/public/app/{id}/definition
   backtest, tributario, bitácora   ◄──   POST /api/public/app/{id}/submit/{canal}
   sin claves, sin órdenes                con claves, sin permiso de retiro
```

Las dos mitades se hablan por el **gateway público de la plataforma**
(APP-SPEC §7.b): sin backend a medida, sin servidor propio.

### Y la advertencia que la app muestra antes de dejarte entrar

El estudio más citado sobre trading intradía minorista siguió a quienes operaron
más de 300 días: **el 97% perdió dinero** y solo el 1,1% ganó más que el salario
mínimo, sin evidencia de aprendizaje con la experiencia (Chague, De-Losso y
Giovannetti, SSRN 3423101). Los reguladores europeos reportan entre 74% y 89% de
cuentas minoristas en pérdida.

Esta app está construida sobre ese supuesto: es un sistema de **disciplina y
control de riesgo**, no una máquina de ingresos. Ningún conjunto de indicadores,
agentes o interés compuesto asegura rentabilidad. No es asesoría financiera,
legal ni tributaria.

---

## Las diez pantallas

| Pestaña | Qué resuelve |
|---|---|
| **📊 Panel** | Capital, marca de agua, P&L del día contra su límite, índice de riesgo de contexto, estado de los tres motores, aprobaciones pendientes y el botón de pánico. |
| **📈 Mercado** | Velas de Binance (endpoints públicos, sin clave), indicadores calculados en la app, los patrones de la última vela, régimen de BTC y el desglose completo del sistema de confluencia con sus pesos. |
| **⚙️ Motores** | Swing, day y scalping: capital, modo de autonomía, fase alcanzada, setups activables uno a uno, pares, y la configuración operativa de cada uno con su justificación. Más la hoja de ruta de 8 fases. |
| **🛡️ Riesgo** | Los límites de los cuatro niveles, el simulador del veto determinista, el índice de riesgo de contexto con sus seis factores, los criterios de promoción y las reglas contra el sobreajuste. |
| **✅ Aprobaciones** | Modo Asesor: cada propuesta del motor con su tesis, su evaluación de riesgo y los botones de aprobar o rechazar. Una propuesta vetada **no se puede aprobar**. |
| **🧪 Backtest** | Motor orientado a eventos sobre las velas reales, con comisión por lado, deslizamiento y rechazo de órdenes maker. Métricas y semáforo contra los criterios del §10.4. |
| **💧 Capital** | La cascada de ganancias con marca de agua, el simulador de interés compuesto que muestra el intercambio entre retirar y capitalizar, y la trayectoria por edad. |
| **🧾 Tributario** | Libro de operaciones, mayor valor por FIFO **y** por precio promedio ponderado, tabla del Global Complementario AT 2026, impuesto atribuible a la ganancia cripto y exportación del respaldo DJ 1964. |
| **🔌 Puente** | Identidad de la cabina, token compartido, estado del motor, los endpoints, el `.env` listo para copiar y los archivos del motor para descargar. |
| **📜 Bitácora** | Registro con hora de cada decisión, cambio de límite y movimiento de capital. Exportable. Más la rutina operativa diaria, semanal, mensual, trimestral y anual. |

---

## Las decisiones que vale la pena conocer

### El veto es código, no IA

Los agentes de análisis proponen tesis; `evaluarRiesgo()` decide. Es
determinista a propósito: ninguna salida de un modelo de lenguaje —ni una
noticia con instrucciones escondidas dentro— puede saltarse un límite que está
escrito como una comparación numérica.

El mismo agente está implementado dos veces, en la cabina y en el motor, con los
mismos códigos de veto. No es duplicación por descuido: la cabina lo necesita
para explicar *por qué* rechaza algo sin preguntarle al VPS, y el motor lo
necesita porque lo que llega por el gateway es dato de un cliente, y ningún
cliente decide.

### El tamaño de posición lleva el costo en el denominador

```
nocional = (capital_motor × riesgo_op) ÷ (distancia_al_stop% + costo_ida_y_vuelta%)
```

Sin el costo ahí, una pérdida planificada de 1% se convierte en una de 1,15% en
cuanto se pagan las comisiones. Con 10.000 USDT, riesgo 1%, stop a 6% y costo
0,15%, la posición son 1.626 USDT.

### Relajar un límite espera 48 horas; endurecerlo es inmediato

Un sistema automático no elimina el riesgo humano: subir el límite tras una
racha perdedora es exactamente cómo se destruyen las cuentas. Un cambio que
relaja un límite queda pendiente, con hora, y se confirma pasada la espera.
Todo queda en la bitácora.

### La marca de agua

Solo se reparte lo que está **por sobre el máximo histórico** del capital.
Mientras se recupera una caída, la ganancia vuelve entera al capital y no se
retira nada. Es lo que impide sacar capital disfrazado de ganancia.

### El backtest asume lo peor dentro de la vela

Cuando una vela toca el stop y el objetivo, no se sabe cuál fue primero: se
asume el stop. Suponer lo contrario infla cualquier resultado. También cobra
deslizamiento en la entrada y en la salida, y modela el rechazo de las órdenes
`LIMIT_MAKER`, que es lo que de verdad mata al scalping.

### Los 26 patrones, adaptados a un mercado 24/7

Están los 26 del catálogo, con su regla numérica y el contexto de tendencia
exigido (un patrón de reversión sin tendencia previa no es un patrón: es una
vela). Dos correcciones deliberadas al material de origen:

- **Cripto casi no tiene huecos.** Pateador, línea de perforación y las
  estrellas se relajan a «hueco entre cuerpos». El bebé abandonado, que sí exige
  rango aislado, queda marcado como raro para que nadie lo espere.
- **Los tres cuervos negros** se implementan con la definición estándar —anuncian
  el fin de una tendencia alcista—, no como los describía el PDF de origen.

Ningún patrón dispara una orden: suma puntos al sistema de confluencia.

### Lo que llega por el gateway es dato, no orden

El gateway público acepta envíos de cualquiera que conozca el identificador de
instancia. Por eso:

1. Nada se ejecuta por el hecho de llegar. En Modo Asesor una persona aprueba.
2. Cada envío trae un token compartido. Si no coincide, **se muestra igual,
   marcado**: esconder un envío falso sería peor que verlo.
3. La tesis de una propuesta se pinta como texto, nunca como HTML, y el agente
   IA la recibe marcada como dato externo no confiable.

El gateway acepta 8 envíos cada 5 minutos por IP e instancia, con 5.000
caracteres por campo y sin objetos anidados. El motor late cada 60 segundos y
manda el detalle como JSON dentro del campo `payload`.

---

## Alineación con la plataforma

| Recurso compartido | Qué hace esta app |
|---|---|
| **Colores y forma** (§9, §7.f) | Cero hex sueltos: todo sale de los tokens del tema del host. La app se re-marca sola con la marca del tenant y el modo noche sale gratis. |
| **`shell.brands`** (§7.f) | Lee la marca activa para la cabecera, comprobando antes que exista. Los datos fiscales **no** son de la marca: el RUT del declarante lo guarda la app, como Cotizaciones guarda su emisor. |
| **`shell.saveData` / `shell.items`** (§4) | El modelo va en el documento de la instancia; los envíos del motor llegan como items `submission` del gateway; la política vive en `items/definition.public.data`. |
| **`shell.agent`** (§6) | Ocho herramientas para operar la cabina. El agente **no puede aprobar una orden**: en Modo Asesor la aprobación es el acto humano que el diseño exige. |
| **`shell.config`** (§3.1) | Entorno, modo de autonomía y moneda de cotización desde el formulario ⚙️. |
| **`shell.documents`** (§3.1) | Guardar versión y restaurar funcionan sobre el modelo completo. |
| **Sin red en runtime** (§8) | El bundle viaja entero, sin imports remotos. Si el tenant no tiene salida a internet, Mercado y Backtest lo dicen y el resto —riesgo, capital, tributario, bitácora— sigue completo. |

### Dos decisiones que un revisor podría cuestionar

`node tools/check-app.mjs apps/kimos-trading` sale sin errores ni avisos. Aun
así, dos cosas merecen quedar escritas:

- **La app guarda un RUT.** El campo es `rutDeclarante`: la
  identificación fiscal **del contribuyente que opera la app**, que va en el CSV
  de la DJ 1964. No es la ficha de un cliente, así que `shell.records` no
  aplica: no hay ninguna identidad compartida con otras apps que deduplicar. Es
  el mismo caso que el bloque «Emisor» de Cotizaciones, que APP-SPEC §7.f dice
  explícitamente que guarda la app.
- **No publica `dataSchema`,** así que ninguna otra app puede escribir en ella.
  Es deliberado. Los datos de esta app son un
  libro tributario y una bitácora de auditoría: que otra app pudiera escribir en
  ellos destruiría justamente lo que los hace servir ante una revisión. Sin
  `dataSchema`, la pasarela falla cerrado, que es lo correcto aquí.

---

## Empaquetar e instalar

```bash
node tools/check-app.mjs apps/kimos-trading
node tools/check-versions.mjs kimos-trading
node tools/pack.mjs apps/kimos-trading        # → kimos-trading-1.0.0.kapp
```

En KIMOS: **Tienda → Instalar desde archivo** (superadmin). Instalar por
`.kapp` es lo recomendado para esta app, porque los archivos del motor viajan
en `assets/` y por la vía del catálogo oficial el backend sirve solo `dist/`.

### Puesta en marcha, en orden

1. Abre la app y lee la advertencia.
2. **Pestaña Puente**: genera el token, deja el entorno en *Testnet*, publica la
   política y copia el `.env`.
3. Instala Geminis Core en el VPS (ver [`assets/engine/README.md`](assets/engine/README.md)).
4. Comprueba que llegue el latido y que el token salga como «verificado».
5. **Pestaña Backtest**: prueba los setups antes de encender nada. Los que no
   pasen, quedan archivados con su informe.
6. **Pestaña Motores**: activa solo los setups que pasaron, empezando por swing.
7. Paper trading en Testnet durante los plazos del §10.4 antes de pensar en
   capital real.

---

## Historial

| Versión | Qué trae |
|---|---|
| **1.0.0** | Primera versión. Diez pantallas; tres motores con su configuración operativa y sus setups; agente de riesgo determinista con 20 códigos de veto y espera de 48 h para relajar límites; los 26 patrones de velas con contexto de tendencia y adaptación a 24/7; EMA, RSI, ATR, ADX/DMI, Bollinger, MACD, Stoch RSI, VWAP diario e Ichimoku calculados en la app; sistema de confluencia con pesos por motor; régimen de mercado por BTC; backtesting orientado a eventos con comisiones, deslizamiento y rechazo maker; Modo Asesor con cola de aprobaciones; cascada de ganancias con marca de agua, simulador de interés compuesto y trayectoria por edad; libro tributario con FIFO y PPP, tabla IGC AT 2026, impuesto atribuible y exportación DJ 1964; puente con el motor por el gateway público; bitácora exportable; ocho herramientas de agente; y Geminis Core con su instalador de VPS en `assets/engine/`. |

## Descargo

El trading de criptoactivos conlleva riesgo extremo de pérdida de capital. Este
software es una arquitectura técnica y una herramienta de disciplina; no es
asesoría financiera, legal ni tributaria, y la rentabilidad histórica no
garantiza resultados futuros. La gestión de las claves de API y el cumplimiento
de las obligaciones ante el SII son responsabilidad de quien lo usa.
