# 👥 Clientes — app oficial instalable

**Versión actual: 2.1.0**

Directorio de clientes (CRM liviano): lista con búsqueda, detalle con datos
de contacto, notas internas del equipo y sincronización manual desde
Jumpseller (binding por instancia, botón ⚙ dentro de la app). Las notas se
preservan en cada re-sync.

Bundle ESM puro sobre el contrato AppShell (`globalThis.React`, `shell.items`,
`shell.authFetch`). El sync usa `POST /api/integrations/jumpseller/sync-customers-to-apps`.

## Es la fuente de la identidad `account` (desde 2.1)

KIMOS tenía un problema silencioso: Clientes, Cotizaciones y Prospección
guardaban cada una su propio «Acme SpA», así que el sistema tenía tres Acmes
y ninguna vista completa del cliente.

Desde la 2.1, esta app **publica su contrato** en el manifest y con eso pasa a
ser la fuente de esa identidad para el resto del sistema:

```jsonc
"dataSchema": {
  "recordType": "account",
  "naturalKeys": ["taxId", "email"],
  "fields": [ … ]
}
```

Qué cambia en la práctica:

- Otra app puede **crear o completar** un cliente aquí (necesita
  `data.write:customers` declarado en su manifest y aprobado al instalar).
  Solo pasan los campos de la lista; el resto se ignora.
- `naturalKeys` dice por qué se reconoce a un cliente. Da igual si el RUT
  llega escrito `77.718.188-2` o `777181882`: es el mismo, así que no se crea
  un duplicado.
- Un cliente que entró desde otra app lo dice en su ficha
  («Creado desde la app …»), para que nadie se pregunte de dónde salió.
- Los campos que gestiona la plataforma (`id`, `createdAt`, `updatedAt`,
  `createdBy`…) no se pueden escribir desde fuera, aunque se declaren.

Se añade también **RUT** (`taxId`) a la ficha y a la búsqueda: era la clave
natural que faltaba para poder deduplicar de verdad.

Ver `APP-SPEC.md` §7.c (contrato de datos) y §7.d (identidades compartidas).
