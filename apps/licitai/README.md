# LicitAI — App para KIMOS (`.kapp`)

UI de **LicitAI** empaquetada como app instalable del shell de KIMOS. A diferencia
de las apps de ejemplo (que no tienen backend), LicitAI conserva su **motor**:
un backend FastAPI en Cloud Run que hace la ingesta de Mercado Público, los
agentes de IA (Claude), embeddings/pgvector y el aislamiento multi-tenant (RLS).
Este bundle es solo la **interfaz**, que corre en el navegador dentro del shell y
llama al motor por `fetch` (CORS habilitado). Ver `docs/architecture/kimos-kapp.md`.

**Versión actual:** 0.7.0

## Cómo se construye

```bash
cd kapp
npm install
npm run build          # genera dist/index.js (ESM) + dist/index.css
```

El build usa Vite en modo librería: React NO se empaqueta (se alias-ea a un shim
que reexpone `globalThis.React`), y el CSS sale a `dist/index.css`.

## Verificar el contrato KIMOS

Con el repo `kimos-packages` al lado:

```bash
node kimos-packages/tools/check-app.mjs licitAI/kapp
```

## Configuración

`configSchema.apiUrl` — URL del backend LicitAI. Por defecto apunta al Cloud Run
de producción; el usuario puede cambiarla desde ⚙️ Configurar (p. ej. a un backend
propio del tenant).

## Historial

| Versión | Cambios |
|---|---|
| 0.7.0 | **Registro** en la pantalla de acceso: alterna Ingresar/Crear cuenta (POST /auth/register + login), para que un cliente nuevo pueda estrenar su empresa desde el kapp. |
| 0.6.0 | **Credenciales seguras por fuente** en la pestaña Fuentes: campo tipo password para la clave de API (ticket de Mercado Público u otra plataforma), guardada CIFRADA por el backend (write-only, nunca se vuelve a mostrar; `PUT /sources/connections/{id}/credentials`) con estado "🔒 configurada" y borrado. Cada empresa usa su propia clave. |
| 0.5.0 | **Pantalla Fuentes**: gestiona las conexiones de fuente y sus **keywords** (crear/editar/habilitar) y botón **Recalcular matches** — desbloquea el flujo de Matches desde el kapp (`/sources/connections`, `/matches/refresh`). |
| 0.4.0 | **`shell.records`**: al preparar una postulación, la licitación se registra como `opportunity` (clave = código) y el organismo como `account` en el grafo de identidades compartido de KIMOS (opcional/guardado). **`shell.files` + bases**: sección "📎 Bases y documentos" en la ficha — sube al motor (`/knowledge/upload`, escaneo + indexado que usa el agente) y espeja al almacenamiento del host si expone `shell.files`; lista los adjuntos. Permisos `records.link`, `files.write`. |
| 0.3.0 | **Agente de postulación**: botón "Preparar postulación con IA" en la ficha (`/applications/prepare`), pestaña **Postulaciones** con borrador por secciones y aprobar/rechazar (human-in-the-loop); maneja 402 (plan) / 403 (permiso). **Chat IA (RAG)**: conversación anclada en el conocimiento cargado, con fuentes (`/agent/chat`). |
| 0.2.0 | **Puente de identidad v1**: refresh silencioso del JWT (login una vez, sesión persistente por instancia; 401 → re-login). **Ficha completa** de la licitación (tipo, comprador con teléfono/correo, cronograma, ítems/especificaciones, garantías seriedad+fiel cumplimiento, adjudicación con acta, objeto/bases). **Matches** por empresa. Navegación Buscar/Matches/Ficha con semáforo por urgencia. Lee `shell.brand` (nombre del tenant en la cabecera). |
| 0.1.0 | Scaffold del kapp: `mount(shell)`, login contra el backend LicitAI (JWT), búsqueda del catálogo, persistencia del token con `shell.saveData`, colores desde los tokens del tema. Primer slice vertical. |

## Pendiente (roadmap del kapp)

- **Agente de postulación** (POST /applications/prepare + revisión) y **chat RAG** (streaming).
- `shell.records` para identidades (opportunity/account) y `shell.files` para adjuntos/bases.
- Puente de identidad **nativo** (SSO): hoy es login por email/clave con refresh; el SSO
  desde la identidad de KIMOS requiere que el shell exponga un token de identidad
  verificable al kapp (dependencia de plataforma).
- Publicar `apps/licitai/` en el `manifest.json` raíz de `ZagrebDev/kimos-packages` (Tienda).
