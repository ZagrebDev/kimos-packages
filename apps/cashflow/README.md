# KIMOS Cashflow 💰

**Agente Financiero Inteligente** del ecosistema KIMOS (Knowledge-based
Integrated Multi-Agent Orchestration System). No es solo un flujo de caja
tradicional: comprende documentos financieros, propone registros, proyecta
escenarios y asiste la toma de decisiones — siempre con el humano al mando.

**Versión actual: 1.3.0**

## Módulos

| Módulo | Qué hace |
|---|---|
| 📊 **Dashboard** | KPIs financieros (ingresos, egresos, utilidad, saldo, liquidez, CxC, CxP), gráficos dinámicos (flujo mensual, gastos por categoría/proyecto), comparativos por período. |
| 💸 **Flujo de Caja** | Registro de ingresos/egresos con editar, eliminar y duplicar. Bruto/neto/IVA **sincronizados en vivo** (editar cualquiera recalcula los demás con la tasa configurada). Vistas diaria, semanal, mensual, trimestral, anual y personalizada. Filtros avanzados y búsqueda inteligente. |
| 📒 **Libro Diario Inteligente** | Asientos Debe/Haber generados automáticamente desde cada movimiento (cuenta, categoría, IVA débito/crédito), con glosa completa y exportación CSV. |
| 📁 **Gestor Documental** | Carga por arrastre, cámara, múltiple y masiva de PDF, JPG/PNG, XML (DTE), CSV y texto. Las imágenes se comprimen localmente; todo queda almacenado en la instancia (local-first, sincronizable con KIMOS Cloud). |
| 🤖 **Comprensión Documental Multimodal** | No es un OCR tradicional: pipeline de comprensión (identificación del tipo de documento → extracción → validación → clasificación → propuesta). XML DTE nativo; **PDF con texto embebido** (facturas/boletas electrónicas, comprobantes Mercado Pago/SumUp/Transbank) se interpretan 100% local; texto/CSV con heurísticas; fotografías con **captura inteligente** (compresión + auto-contraste) listas para visión/OCR del agente KIMOS (IA agnóstica: OpenAI/Claude/Gemini/Ollama Vision, Tesseract, PaddleOCR, Docling, modelos locales o MCP). Rescata fecha, hora, RUT (validado módulo 11), razón social/comercio, giro, dirección, folio, neto/IVA/total/exento, detalle de ítems, medio de pago, cuotas, banco y referencia. |
| 🎯 **Confianza por campo** | Cada dato extraído lleva su % de confianza (RUT validado 99%, montos cuadrados 99%, comercio por posición 60%, …), visible en Revisión con semáforo. Bajo 60% la app **no permite aprobar sin confirmación explícita** del usuario. |
| 🧠 **Memoria Financiera** | Aprende de cada registro aprobado: proveedor→categoría/proyecto/centro de costos/tipo y palabras clave→clasificación (SODIMAC→Materiales, MDF→Producción…). Enriquece las propuestas con confianza creciente, se expone al agente en el snapshot para clasificar consistente, y **nunca registra sola**. |
| ✅ **Human in the Loop** | La IA **nunca** registra en firme: toda extracción o propuesta de agente entra a la bandeja de Revisión, donde el usuario aprueba, edita, rechaza, pospone o pide nueva interpretación. Todo queda en la auditoría. |
| 📈 **Proyecciones y Presupuestos** | Proyección de flujo por tendencia + recurrentes + CxC/CxP pendientes; presupuestos por categoría y período con semáforo de ejecución. |
| 🔍 **Análisis Inteligente** | Detección de gastos duplicados, documentos repetidos, inconsistencias (IVA/neto/total), baja liquidez, gastos inusuales, alza de costos y caída de ingresos, con recomendaciones. |
| 🏢 **Multiempresa** | Empresas con RUT/giro, múltiples cajas y cuentas bancarias, centros de costos, proyectos y categorías personalizadas. Multitenant vía equipos/instancias del shell. |
| ⚖️ **Parámetros tributarios** | Tasa de IVA editable en Ajustes (19% por defecto — tasa general vigente en Chile, art. 14 DL 825): alimenta la calculadora neto/IVA y la validación de consistencia del Análisis. Además: moneda, umbral de liquidez y decimales, con cada cambio auditado. También configurables vía ⚙️ del shell. |

## Human in the Loop (contrato)

Las herramientas de escritura financiera del agente (`PROPOSE_MOVEMENT`,
`PROPOSE_FROM_TEXT`) **solo crean propuestas** en la bandeja de Revisión. El
usuario decide: ✔ aprobar (crea el movimiento y su asiento), ✏ editar antes de
aprobar, ✖ rechazar, 🕓 posponer o 🔄 reinterpretar. Cada decisión y cada
mutación relevante queda registrada en **Auditoría** (quién/qué/cuándo).

## Control por agente (`agent.control`)

`getSnapshot()` expone empresas, cuentas, categorías, KPIs del período y
propuestas pendientes. Tools:

- `PROPOSE_MOVEMENT` — propone un ingreso/egreso (HITL); acepta `fieldConfidence` por campo (visión/LLM) y pasa por la Memoria Financiera.
- `PROPOSE_FROM_TEXT` — corre el pipeline de comprensión sobre texto OCR/plano y propone (HITL) con confianza por campo.
- `LIST_MOVEMENTS` — consulta movimientos con filtros.
- `GET_FINANCIAL_SUMMARY` — KPIs de un rango de fechas.
- `RUN_ANALYSIS` — devuelve las alertas/hallazgos del análisis inteligente.
- `ADD_CATEGORY` / `ADD_PROJECT` / `ADD_COST_CENTER` — catálogos (auditado).

## Arquitectura

- Bundle ESM autocontenido (AppShell v1): `globalThis.React`, sin build en el
  host, CSS con scope `.kimos-cashflow`, estado por instancia en closure.
- Persistencia local-first: un documento-modelo vía `shell.saveData/loadData`
  con *debounce*; compatible con 🗂️ Documentos y ⚙️ Configurar (AppShell v2).
- Modular por diseño: cada módulo es una pestaña/función pura sobre el mismo
  modelo → integrable a futuro con CRM, proyectos, ventas, inventario, RR.HH.
  o licitaciones de KIMOS sin rehacer la arquitectura.
- Responsive (desktop, notebook, tablet, smartphone, tótems FIGIT.ai, PWA del
  shell) y adaptado a modo claro/oscuro vía las CSS vars del tema del shell.

## Alineación con la plataforma (ALINEA-TU-APP.md)

`node tools/check-app.mjs apps/cashflow` pasa sin errores ni avisos. Lo que
esta app dejó de resolver por su cuenta, y lo que decidió seguir haciendo:

| Pieza compartida | Qué hace Cashflow |
|---|---|
| **Identidades (`shell.records`, §7.d)** | El proveedor o cliente de cada movimiento se vincula con la identidad del sistema (`account`) por su RUT: la misma empresa es la misma en Cashflow, Cotizaciones y Clientes. Se guardan **las dos cosas** —la referencia (`recordRef`) y la instantánea (`counterpart`, `counterpartRut`)—, así que un movimiento registrado hace ocho meses sigue diciendo con quién se hizo aunque el registro se renombre o desaparezca. Al abrir, las referencias fusionadas se reapuntan solas; ninguna instantánea se reescribe. |
| **Marca del tenant (`shell.brands`, §7.f)** | La razón social y el RUT de la empresa emisora se rellenan desde la marca (🏷 en Ajustes, y automáticamente en la empresa recién sembrada). **Rellena, no impone**: una empresa que ya tiene RUT escrito no la pisa la marca, porque un tenant con dos unidades de negocio necesita llevar la caja de la otra. |
| **Colores (§9)** | Ningún hex suelto: acento, ingreso, egreso y alerta salen de los tokens del tema del host (`--primary`, `--success`, `--destructive`, `--warning`), así que la app se re-marca sola con la marca del tenant. |
| **Versión a la vista (§7.a)** | Chip `v1.3.0` en la cabecera, `APP_VERSION` en el bundle y `version` en el snapshot del agente. |

Las dos piezas son **opcionales en el contrato**: en un host que no expone
`shell.records` ni `shell.brands`, la app funciona exactamente igual —la
contraparte se escribe a mano y la empresa también—, y Ajustes lo dice en vez
de fingir que hay directorio.

### Decisiones tomadas y por qué (avisos que no se atendieron)

- **Los documentos NO van a `shell.files` (§7.e).** La URL que devuelve
  `files.upload` es **pública de lectura**, y lo que esta app guarda son
  facturas, boletas y comprobantes de pago con RUT, montos y datos bancarios.
  Se quedan local-first en la instancia (tope de 1,2 MB por archivo, imágenes
  comprimidas antes de guardar). Si el contrato incorpora almacenamiento
  privado por app, este es el primer sitio donde conviene moverlos.
- **No publica `dataSchema` (§7.c).** La pasarela de escritura entre apps
  opera sobre `shell.items`, y el modelo de Cashflow vive en un documento
  único (`saveData`). Publicar un contrato sería prometer una puerta que no
  existe. Además, la escritura financiera desde fuera tendría que entrar por
  la bandeja de Revisión, no directa: mover el modelo a items es el paso
  previo, y es una versión mayor.

## Historial

| Versión | Qué trae |
|---|---|
| **1.3.0** | Alineación con la plataforma: identidad compartida de la contraparte (`shell.records`), empresa emisora desde la marca del tenant (`shell.brands`), colores semánticos desde los tokens del tema, versión en pantalla y suite de smoke tests (`test/smoke.mjs`). |
| 1.2.0 | Comprensión documental multimodal (XML DTE, PDF con texto embebido, vouchers POS), confianza por campo, memoria financiera y montos bruto/neto/IVA sincronizados en vivo. |
| 1.1.0 | Tasa de IVA editable en Ajustes (19% por defecto, art. 14 DL 825). |
| 1.0.0 | Primera versión: flujo de caja multiempresa, libro diario, gestor documental, Human in the Loop, dashboard, proyecciones, presupuestos y análisis. |

## Pruebas

```bash
node apps/cashflow/test/smoke.mjs      # contrato del agente, records, marca, render de las 8 pestañas
node tools/check-app.mjs apps/cashflow # alineación con la plataforma
node tools/check-versions.mjs cashflow # la versión, en los cuatro sitios
```

## Principios

Seguridad · Privacidad · Transparencia · Inclusión Tecnológica · Prosperidad
Humana · Human in the Loop · IA Responsable · Escalabilidad · Modularidad ·
Trazabilidad Financiera.
