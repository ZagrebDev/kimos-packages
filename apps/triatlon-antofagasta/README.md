# Triatlón Antofagasta 🏊

App instalable de Kimos (front v2, contrato `AppShellV1` — Fase 4). Renderiza el
**tótem interactivo de retiro de KIT deportivo** del Triatlón de Antofagasta y lo
expone al **AgentBridge** para que un agente autorizado lo controle.

## Estructura

```
apps/triatlon-antofagasta/
├── manifest.json        # metadata de la app (también declarada en /manifest.json raíz)
├── build.py             # genera dist/index.js a partir de src/
├── src/
│   ├── totem.html       # HTML original del tótem (fuente de la verdad)
│   └── protocol.html    # <script> del protocolo KIMOS inyectado en el tótem
└── dist/
    └── index.js         # bundle ESM servido al front (GENERADO — no editar a mano)
```

Para regenerar el bundle tras editar el HTML:

```bash
cd apps/triatlon-antofagasta && python3 build.py
```

## Cómo se instala

El backend (`appsAPI.py`) lee la sección `apps[]` de `/manifest.json`, descarga
`apps/triatlon-antofagasta/dist/index.js` desde `raw.githubusercontent` (rama
`main`) y lo sube a GCS. En el front v2 aparece en **Tienda → Instalar** y, una
vez instalada, en el **HomeLauncher → Instaladas**.

> Nota: el backend descarga desde la rama **`main`**, así que la app queda
> instalable cuando este cambio se mergea a `main`.

## Contrato

El bundle exporta `default function mount(shell)` y devuelve `{ Component, unmount }`.
`Component` es un `<iframe srcDoc>` en sandbox con el tótem; `mount` registra la
app en el AgentBridge vía `shell.agent.register(...)`.

## Control por agente

El tótem y el bundle hablan por `postMessage`. Tools expuestas al agente:

| Tool           | Efecto                                                                 |
| -------------- | --------------------------------------------------------------------- |
| `SET_RUT`      | Ingresa un RUT en el teclado (`{ rut: "13.036.971-8" }`).             |
| `VALIDATE_RUT` | Valida el RUT y avanza a federado / no federado / no registrado.      |
| `INSCRIBIR`    | Confirma la inscripción de un competidor **federado**.                |
| `PAGAR`        | Confirma el pago de $15.000 de un competidor **no federado**.         |
| `RESET`        | Vuelve a la pantalla inicial de ingreso de RUT.                       |

RUTs de demo: `13.036.971-8` (federado), `26.031.103-4` (no federado).

### Autorización

El control se rige por `enterprise.settings.agentPermissions`:

- `kimosai` tiene acceso total por defecto.
- Para otro agente, añade el id de la app a su lista de apps:

```json
{
  "agentPermissions": {
    "<agentId>": { "apps": ["triatlon-antofagasta"] }
  }
}
```
