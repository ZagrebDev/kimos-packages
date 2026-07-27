# KIMOS Cashflow 💰

**Agente Financiero Inteligente** del ecosistema KIMOS (Knowledge-based
Integrated Multi-Agent Orchestration System). No es solo un flujo de caja
tradicional: comprende documentos financieros, propone registros, proyecta
escenarios y asiste la toma de decisiones — siempre con el humano al mando.

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

## Principios

Seguridad · Privacidad · Transparencia · Inclusión Tecnológica · Prosperidad
Humana · Human in the Loop · IA Responsable · Escalabilidad · Modularidad ·
Trazabilidad Financiera.
