# Notas de Equipo 🗒️

App instalable de **ejemplo** (multi-instancia) para validar end-to-end la
plataforma v2 de apps instalables, sin tocar la app de triatlón.

## Qué valida

- **Acceso por equipo (Fase 1):** en la Tienda, un superadmin asigna equipos a
  la app. Solo esos equipos (usuarios y agentes) la ven y la usan.
- **Multi-instancia (Fase 2):** `multiInstance: true`. Cada equipo crea sus
  propias instancias desde HomeLauncher → "Apps" → *Notas de Equipo* → Nueva.
- **Datos por instancia (Fase 3):** cada nota se guarda con `shell.items`
  (subcolección `items/` de la instancia, mismo backend que kanban).
- **Control por agente:** tools `ADD_NOTE { text }`, `DELETE_NOTE { id }`,
  `LIST_NOTES`. Un agente autorizado por equipo puede operar la instancia.

## Prueba sugerida

1. Mergear a `main` (el backend instala el bundle desde `kimos-packages/main`).
2. Tienda → instalar "Notas de Equipo" → (opcional) asignar equipos en "Acceso".
3. HomeLauncher → Apps → *Notas de Equipo* → "Nueva" (crea una instancia en tu
   equipo activo).
4. Agregar/eliminar notas; abrir un chat de agente y pedir "agrega una nota …".

## Implementación

Bundle ESM puro (`dist/index.js`) que usa `globalThis.React` (expuesto por el
host) y cumple el contrato `AppShellV1` (`mount(shell) -> { Component, unmount }`).
No requiere paso de build.
