# Eventos Triatlón 🏊 (esqueleto)

App instalable **multi-instancia**: cada instancia es un **evento** de triatlón
(p.ej. "Triatlón Antofagasta 2026"), creado por un equipo. Es el **esqueleto de
Fase 4** sobre la plataforma v2 — la integración de plataforma está completa; el
flujo/visual definitivo del tótem se reemplaza dentro sin tocar esa integración.

## Modelo
- **App = plantilla** "Eventos Triatlón" (habilitable a equipos desde la Tienda).
- **Instancia = evento** (`ownerTeamId`), creado por un equipo desde
  HomeLauncher → Apps → "Nueva".
- **Competidores = items** de la instancia (`shell.items`): `{ rut, nombre, tipo,
  inscrito, pagado }`.
- **Config del evento** (nombre, costo) por instancia vía `shell.saveData/loadData`.

## Tools de agente (por instancia)
| Tool | Efecto |
| --- | --- |
| `REGISTRAR { rut }` | Valida el RUT contra el registro; inscribe si es federado, informa pago si no, o "no registrado". |
| `CONFIRMAR_PAGO { rut }` | Confirma el pago de un no federado. |
| `ADD_COMPETITOR { rut, nombre, tipo }` | Agrega un competidor. |
| `REMOVE_COMPETITOR { rut }` | Elimina un competidor. |
| `LIST_COMPETITORS` | Lista los competidores. |
| `SET_EVENT_NAME { nombre }` | Renombra el evento. |

## Sustituir el flujo del tótem
La UI actual es un placeholder data-driven (input de RUT + lista de
competidores). Para integrar el tótem definitivo, reemplaza el `Component` (o
monta tu HTML en un `<iframe srcDoc>`), conservando las funciones de datos
(`shell.items`) y el registro de agente. Bundle ESM puro con `globalThis.React`.
