# Triatlón Antofagasta 🏊 (v2)

App instalable de Kimos (front v2, contrato `AppShellV1`). Kiosco del **Americas
Triathlon Championships Antofagasta 2026**: inscripción de atletas, información
del evento y atletas, en 3 idiomas (ES/EN/PT), controlable por un **agente
autorizado** vía AgentBridge.

## Estructura
```
apps/triatlon-antofagasta/
├── manifest.json     # metadata (también en /manifest.json raíz)
├── build.py          # genera dist/index.js desde src/ (+ inyecta <base> y protocolo)
├── src/
│   ├── totem.html        # HTML del kiosco (datos de participantes y rutas embebidos)
│   ├── protocol.html     # protocolo KIMOS postMessage (control por agente)
│   ├── participantes.json / rutas.geojson / process_data.py  # provenance
├── assets/
│   ├── fotos/        # fotos de atletas
│   └── banderas/     # banderas por país (NOC)
└── dist/index.js     # bundle ESM (GENERADO — no editar a mano)
```

Regenerar tras editar el HTML:
```bash
cd apps/triatlon-antofagasta && python3 build.py
```

## Assets
Las imágenes se referencian por ruta relativa (`fotos/…`, `banderas/…`) y se
resuelven contra un `<base>` inyectado que apunta a este repo en GitHub raw
(rama `main`). Los datasets (participantes, rutas) están embebidos en el HTML,
así que no hay `fetch` en runtime.

## Control por agente
El kiosco y el bundle hablan por `postMessage`. Tools expuestas:

| Tool | Efecto |
| --- | --- |
| `OPEN_REGISTER` | Abre la inscripción (paso categorías). |
| `OPEN_INFO { tab }` | Abre info (`athletes`/`guide`/`map`/`schedule`). |
| `RETURN_HOME` | Vuelve al inicio. |
| `CHANGE_LANGUAGE { lang }` | Cambia idioma (`es`/`en`/`pt`). |
| `SELECT_CATEGORY { categoria }` | Elige categoría y avanza a atletas. |
| `SEARCH_ATHLETE { texto }` | Filtra atletas de la categoría. |
| `SELECT_ATHLETE { nombre, pais? }` | Elige atleta y avanza a confirmar. |
| `CONFIRM` | Confirma (nacional→valida sin costo; extranjero→pago). |
| `PAY` | Simula el pago con tarjeta (POS). |
| `FINISH` | Finaliza y reinicia el kiosco. |

Flujo típico: `OPEN_REGISTER` → `SELECT_CATEGORY` → `SELECT_ATHLETE` →
`CONFIRM` → (`PAY` si no es nacional). La autorización del agente se rige por
`enterprise.settings.agentPermissions` (kimosai tiene acceso total).
