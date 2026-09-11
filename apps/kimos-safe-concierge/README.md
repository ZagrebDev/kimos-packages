# KIMOS Safe Concierge 🛡️

Consejería virtual con IA para **comunidades residenciales, edificios
corporativos y porterías**: un tótem táctil con avatar que atiende el acceso
24/7 y una consola de seguridad que convierte cámaras, sensores y accesos en
**incidentes contextualizados, trazables y accionables**.

Versión actual: **1.2.0**

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
| 🪧 **Tótem** | La pantalla del visitante: **Denzel Barrett**, conserje virtual 3D con voz, junto al espejo en vivo de quien está frente a la cámara; teclado en pantalla, visitas, residentes, citofonía, encomiendas, **hablar con una persona** y botón de auxilio. Modo pantalla completa |
| 📡 **Central** | Monitoreo humano: audio y video en vivo con el acceso y la **cola de validación** de alertas |
| 📁 **Documentos** | Archivos en el Cloud Storage de KIMOS: plan de emergencia, reglamento, evidencia y capturas |
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

## La pantalla del tótem

Tres cosas a la vez: **el conserje virtual, la persona que está frente al acceso
y lo que necesita hacer**.

- **Denzel Barrett** — conserje virtual 3D: retrato por capas con volumen,
  uniforme, placa y gorra; parpadea, respira, mueve la cabeza, sincroniza la
  boca al hablar y **sigue con la mirada** el centro de movimiento que ya
  calcula el sensor de la cámara. Nombre y aspecto son **100% editables** desde
  el **Estudio del avatar** (pestaña Panel): estilo, piel, pelo, ojos, barba,
  gorra, uniforme, vivos, iniciales de la placa y porte, con vista previa en
  vivo y cuatro presets.
- **Espejo en vivo** — la misma señal que analiza el sensor, en un recuadro
  grande bajo el avatar, rotulada «Usted · vista en vivo · no se graba».
- **Teclado en pantalla** — QWERTY español (ñ y acentos) y numérico para
  códigos. En modo tótem se abre al tocar un campo; en la consola, con ⌨.
- **Hablar con una persona** — abre audio y video con la central; el marco del
  conserje pasa a mostrar **la cara del operador** mientras dure la llamada.

## La central de monitoreo (personal humano)

| Pieza | Qué hace |
|---|---|
| **Enlace en vivo** | WebRTC punto a punto entre el tótem y la central. La señalización viaja por los items de la instancia: sin servidor a medida. STUN público por defecto; TURN configurable para redes cerradas |
| **Quién abre el canal** | El visitante (botón del tótem), la central («👁 Ver el acceso ahora») o un incidente de nivel ≥ 3 (configurable). El tótem **anuncia en pantalla** que la central está mirando, mientras dure |
| **Validación humana** | Toda alerta automática nace `pendiente`. Una persona la aprueba o la descarta, con su nombre |
| **Compuerta dura** | Con la alerta pendiente, escalar está **bloqueado** — en la UI y en el agente IA. Lo declarado por una persona en el tótem nace aprobado: ahí ya decidió alguien |

El orden es deliberado: **validar ≠ contactar**. Aprobar solo habilita el
escalamiento; el contacto se registra aparte, con quién lo autoriza.

## Archivos en el Cloud Storage

Plan de emergencia, reglamento, actas, documentos de unidades, fotos de
encomiendas y evidencia de incidentes van al almacenamiento de la plataforma,
no dentro del documento de la instancia. Con `shell.files` (AppShell v2, §7.e)
la ruta la gestiona el host —aislamiento por app, cuota atribuible y limpieza
al desinstalar— y en un host anterior se cae al endpoint del tenant
(`POST /api/v2/files`, lectura por `/api/public/files/{path}`). Se suben desde **📁 Documentos** (botón o arrastrando
al recuadro) o desde el propio incidente, y el tótem puede **capturar un cuadro
de la cámara** como evidencia sellada. Cada archivo deja su registro en la
bitácora: quién lo subió, cuándo y a qué incidente o unidad pertenece.

## Las cuatro decisiones de diseño

1. **La IA propone, la persona decide.** Ninguna detección llama sola a un
   servicio de emergencia ni abre un acceso. Desde 1.2.0 hay dos compuertas en
   serie: la central **valida** la alerta (`APPROVE_INCIDENT`, con el nombre de
   quien revisó) y recién entonces alguien puede **autorizar** el contacto
   (`ESCALATE_INCIDENT`, con el nombre de quien lo autoriza).
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
APPROVE_INCIDENT · DISMISS_INCIDENT · ESCALATE_INCIDENT · CLOSE_INCIDENT ·
LOG_ACCESS · DECIDE_ACCESS · RECEIVE_PARCEL · RELEASE_PARCEL · UPSERT_UNIT ·
SPEAK · SET_SENSORS · OPEN_LINK · ANSWER_LINK · END_LINK · SNAPSHOT ·
LIST_DOCS · VERIFY_LEDGER · SET_VIEW`

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
| `files.write` | Subir al Cloud Storage con la ruta gestionada por el host |

No pide `data.read:*`: la app no lee datos de otras apps. Sí publica un
`dataSchema` con el contrato de las **unidades** (unidad, nombre, torre,
teléfono, correo, notas), para que una app de administración pueda mantener el
directorio del acceso al día sin duplicarlo.

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
| 1.2.0 | Central de monitoreo con personal humano: audio y video en vivo por WebRTC (señalización por items, sin backend a medida), validación humana obligatoria de cada alerta antes de habilitar cualquier contacto, y botón «Hablar con una persona» en el tótem. Conserje virtual **Denzel Barrett**: retrato 3D con mirada que sigue a la persona, y Estudio del avatar para editar nombre y aspecto por completo. Recuadros del avatar y del espejo mucho más grandes, interfaz del tótem rediseñada. Archivos y documentos en el Cloud Storage de KIMOS, con captura de evidencia desde la cámara. |
| 1.1.0 | El tótem muestra al conserje virtual **y** el espejo en vivo de quien está frente a la cámara; teclado en pantalla (QWERTY español y numérico) para escribir sin teclado físico; encender la cámara desde el propio tótem. |
| 1.0.0 | Primera versión: tótem con avatar (humanizado / caricaturizado / abstracto), motor de riesgo de cinco niveles, detección local por cámara y micrófono, ingesta de cámaras externas, accesos, encomiendas, directorio, emergencias con validación humana, bitácora sellada con SHA-256 y pestaña de cumplimiento. |
