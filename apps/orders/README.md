# 🛒 Pedidos — app oficial instalable

Gestión de pedidos genérica: lista con búsqueda y filtro por estado, detalle
con los productos del pedido, notas internas del equipo y sincronización
manual desde Jumpseller (binding por instancia, botón ⚙ dentro de la app).
Las notas y campos manuales se preservan en cada re-sync.

Bundle ESM puro sobre el contrato AppShell (`globalThis.React`, `shell.items`,
`shell.authFetch`). El sync usa `POST /api/integrations/jumpseller/sync-orders-to-apps`.
