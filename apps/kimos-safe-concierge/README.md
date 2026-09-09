# KIMOS Safe Concierge 🛡️

Consejería virtual con IA para **comunidades residenciales, edificios
corporativos y porterías**: un tótem táctil con avatar que atiende el acceso
24/7 y una consola de seguridad que convierte cámaras, sensores y accesos en
**incidentes contextualizados, trazables y accionables**.

Versión actual: **1.1.0**

- **Contrato**: AppShell **v1** (`appShellApi: "1.x"`), `multiInstance: true`.
  Las capacidades v2 —⚙️ Configurar y `shell.config`— se usan solo si el host
  las ofrece, así que la app funciona igual en un host v1.
- **Una instancia = un acceso** (una portería, una torre, una recepción). Cada
  registro es un item, de modo que dos consolas trabajando a la vez no se pisan.
- **Investigación y fundamentos**: repositorio
  [`kimos-safe-Concierge`](https://github.com/bvaldes-arch/kimos-safe-Concierge).

---

## Qué hace

| Módulo | Lo esencial |
|---|---|
| 📊 **Panel** | Estado del acceso, incidentes en curso, sensores y los tres tiempos que importan (MTTD / MTTE / MTTR) |
| 🪧 **Tótem** | La pantalla del visitante: conserje virtual con voz **y espejo en vivo de quien está frente a la cámara**, teclado en pantalla, visitas, residentes, citofonía, encomiendas y botón de auxilio. Modo pantalla completa |
| 🚨 **Incidentes** | Bitácora forense: nivel de riesgo, confianza, contexto, acciones, escalamiento y cierre |
| 🚪 **Accesos** | Ingresos y salidas, decisiones pendientes de las visitas, búsqueda y exportación CSV |
| 📦 **Encomiendas** | Recepción → código de retiro → notificación → retiro validado, sin que el repartidor entre |
| 🏠 **Directorio** | Unidades, contacto y código de ingreso (sin biometría) |
| 📞 **Emergencias** | Canales (131 · 132 · 133 · 134 · municipal · CRA · administración), protocolo por tipo de evento y el parte que se entrega |
| ⚖️ **Cumplimiento** | Verificación de la cadena de sellos, retención, inventario de datos y marco legal chileno |

## La pantalla del tótem

Dos caras a la vez: **el conserje virtual y la persona que está frente al
acceso**.

- **Conserje virtual** — avatar humanizado, caricaturizado o abstracto, con
  parpadeo, boca sincronizada y voz del navegador.
- **Espejo en vivo** — la misma señal que analiza el sensor, mostrada bajo el
  avatar y rotulada «Usted · vista en vivo · no se graba». Un acceso que te
  devuelve la mirada disuade más que un cartel, y la persona ve exactamente qué
  está mirando el sistema. Si la cámara está apagada, el recuadro ofrece
  activarla (el navegador pide permiso con ese gesto).
- **Teclado en pantalla** — QWERTY en español (con ñ y vocales acentuadas) y
  teclado numérico para códigos, con mayúscula inicial automática, retroceso y
  «✓ Listo». En **modo tótem** se despliega al tocar cualquier campo; en la
  consola, solo con el botón ⌨ (ahí sí hay teclado físico). Cada campo tiene
  además su propio botón ⌨.

## Las cuatro decisiones de diseño

1. **La IA propone, la persona decide.** Ninguna detección llama sola a un
   servicio de emergencia ni abre un acceso. `ESCALATE_INCIDENT` **exige** el
   nombre de quien autoriza — al agente IA también se lo pide.
2. **Privacidad por diseño.** Sin biometría. Cámara y micrófono se analizan en
   el dispositivo (diferencia de cuadros y energía acústica): no se suben
   imágenes ni audio, no se transcribe nada y en modo privacidad las personas
   se registran como «Persona N».
3. **Trazabilidad.** Accesos, incidentes y encomiendas se sellan con SHA-256
   encadenado; Cumplimiento recalcula la cadena y muestra cualquier registro
   editado después de guardarse.
4. **Detección honesta.** El motor detecta *patrones compatibles con* agitación,
   forcejeo, gritos o impactos — nunca «delitos». Cada incidente lleva su
   confianza, su contexto y su margen de error a la vista.

## Cómo decide el nivel

```
nivel ← severidad(tipo) × confianza(detección) × contexto
        contexto = hora + intentos + zona + visita registrada + declarado por una persona
```

| Nivel | Qué significa | Qué hace la app |
|---|---|---|
| 0-1 | Normal / Observación | Solo registra |
| 2 | Preventivo | Avisa al personal de turno |
| 3 | Alerta | Aviso disuasivo por el parlante + pide revisión humana |
| 4 | Crítico | Marca retención legal y activa el protocolo del edificio |
| 5 | Emergencia | Propone el escalamiento; el contacto lo confirma una persona |

Un auxilio declarado por alguien en el tótem **nunca baja de Crítico**: el motor
puede dudar de un patrón, no de una persona pidiendo ayuda.

## Cámaras de la comunidad (sin backend a medida)

La VMS o las cámaras con analítica publican sus detecciones por el gateway
público de KIMOS (APP-SPEC §7.b) y entran al mismo motor de riesgo:

```
POST /api/public/app/{instanceId}/submit/deteccion
{ "type": "aggression", "confidence": 0.8, "camera": "Estacionamiento -2", "note": "…" }
```

Se activa en **Cumplimiento → Cámaras de la comunidad**. El envío original se
descarta al convertirse en incidente, para no dejar el dato duplicado.

## Control por agente IA

`STATUS · LIST_INCIDENTS · RAISE_INCIDENT · ACK_INCIDENT · ADD_ACTION ·
ESCALATE_INCIDENT · CLOSE_INCIDENT · LOG_ACCESS · DECIDE_ACCESS ·
RECEIVE_PARCEL · RELEASE_PARCEL · UPSERT_UNIT · SPEAK · SET_SENSORS ·
VERIFY_LEDGER · SET_VIEW`

`SPEAK` hace hablar al avatar del tótem; `SET_SENSORS` enciende o apaga el
análisis local; `ESCALATE_INCIDENT` falla a propósito si no viene quién
autoriza.

## Permisos y por qué

| Permiso | Para qué |
|---|---|
| `instance.read` / `instance.write` | Registros de la instancia (accesos, incidentes, encomiendas, unidades) |
| `agent.control` | Operación por agente IA |
| `public.read` | Publicar la definición del acceso (título y campos que acepta la ingesta) |
| `public.submit` | Recibir detecciones de las cámaras de la comunidad |

No pide `data.read:*`: la app no lee datos de otras apps.

## Marco normativo (Chile)

- **Ley 21.442** — el directorio y los protocolos dan soporte al plan de
  emergencia y al registro de ocupantes de la copropiedad.
- **Ley 21.659** — retención mínima de 120 días y entrega de registros al
  Ministerio Público, tribunales o policías: de ahí el sello y la exportación.
- **Ley 21.719** — los datos biométricos son sensibles; la app funciona entera
  sin biometría, con minimización y borrado automático al vencer la retención.

No es asesoría legal: el reglamento interno y los quórums de la asamblea siguen
siendo de la comunidad.

## Historial

| Versión | Cambios |
|---|---|
| 1.1.0 | El tótem muestra al conserje virtual **y** el espejo en vivo de quien está frente a la cámara; teclado en pantalla (QWERTY español y numérico) para escribir sin teclado físico; encender la cámara desde el propio tótem. |
| 1.0.0 | Primera versión: tótem con avatar (humanizado / caricaturizado / abstracto), motor de riesgo de cinco niveles, detección local por cámara y micrófono, ingesta de cámaras externas, accesos, encomiendas, directorio, emergencias con validación humana, bitácora sellada con SHA-256 y pestaña de cumplimiento. |
