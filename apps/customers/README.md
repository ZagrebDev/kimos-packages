# 👥 Clientes — app oficial instalable

Directorio de clientes (CRM liviano): lista con búsqueda, detalle con datos
de contacto, notas internas del equipo y sincronización manual desde
Jumpseller (binding por instancia, botón ⚙ dentro de la app). Las notas se
preservan en cada re-sync.

Bundle ESM puro sobre el contrato AppShell (`globalThis.React`, `shell.items`,
`shell.authFetch`). El sync usa `POST /api/integrations/jumpseller/sync-customers-to-apps`.
