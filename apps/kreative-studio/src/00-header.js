/**
 * Kreative Studio — plataforma de campañas publicitarias cinematográficas
 * generadas con IA, nativa de KIMOS.
 *
 * QUÉ ES: el usuario sube fotos de un producto, escribe una intención en
 * lenguaje natural ("crea una campaña premium", "quiero un comercial épico",
 * "véndelo para deportistas") y el sistema produce la CAMPAÑA COMPLETA:
 * investigación, concepto creativo, plan de funnel, storyboard con dirección
 * de fotografía, prompts optimizados por proveedor de IA, guion de voz, brief
 * de música, timeline de edición con script FFmpeg, control de marca, copy
 * para todos los canales, registro de assets, versiones y analítica de costos.
 *
 * ARQUITECTURA (Clean Architecture dentro del contrato AppShell de KIMOS):
 *
 *   ┌─ Dominio (scope de módulo, SIN React, SIN IO) ─────────────────────────┐
 *   │  utils · vocabulario de dirección · presets de estilo · base de        │
 *   │  conocimiento de mercado · REGISTRO DE PROVEEDORES · reglas de negocio │
 *   └───────────────────────────────────────────────────────────────────────┘
 *   ┌─ Aplicación (scope de módulo, puro) ──────────────────────────────────┐
 *   │  12 AGENTES especializados (cada uno independiente: recibe un estado   │
 *   │  y devuelve un fragmento nuevo) + ORQUESTADOR de pipeline con DAG,     │
 *   │  estados, tiempos, reintentos y contabilidad de costos.                │
 *   └───────────────────────────────────────────────────────────────────────┘
 *   ┌─ Adaptadores + UI (dentro de mount(shell), con React del host) ────────┐
 *   │  puertos: persistencia (saveData/items), archivos (/api/v2/files),     │
 *   │  notificación, config, documentos · registro de tools para el AGENTE   │
 *   │  DE KIMOS (que es el orquestador externo) · 19 vistas de estudio.      │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * PROVEEDORES REEMPLAZABLES (requisito central): ningún agente conoce a un
 * proveedor concreto. Los agentes producen un `PromptSpec` NEUTRAL (sujeto,
 * cámara, óptica, luz, grade, fx, audio, formato) y el registro de proveedores
 * lo TRADUCE al dialecto de cada modelo. Añadir Midjourney v8, Kling 3 o un
 * modelo propio = añadir un descriptor al registro (`registerProvider`); el
 * núcleo no se toca. Ver `docs/ARQUITECTURA.md` y `docs/PROVIDERS.md`.
 *
 * DETERMINISMO: todo el pipeline corre sin red. La calidad no depende de que
 * haya una API key configurada: las reglas creativas, la investigación por
 * categoría, los benchmarks de canal y la ingeniería de prompts están en el
 * bundle. Las llamadas a modelos generativos (imagen/vídeo/voz) son el paso
 * de PRODUCCIÓN y se despachan como trabajos: el agente de KIMOS (o el
 * usuario) los ejecuta y registra el asset resultante con REGISTER_ASSET.
 *
 * Contrato: export default function mount(shell) -> { Component, unmount }.
 * Bundle generado por `node apps/kreative-studio/build.mjs` (concatena
 * src/*.js en orden). NO editar dist/index.js a mano.
 */
