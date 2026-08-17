# Anfitrión · Desayuno Ejecutivo de Ciberseguridad 2026

Anfitrión consultivo para el **totem** del Desayuno Ejecutivo de Ciberseguridad
2026 de NextTime Software. Una persona se acerca en el hall, ve qué está
pasando ahora, consulta agenda, expositores y marco legal, se lleva lo que
necesita escaneando un QR y deja su pregunta para el panel.

**Versión actual: 2.0.0**

---

## El totem manda el diseño

| Decisión | Por qué |
|---|---|
| **Dos modos** (`.modo-totem` / `.modo-escritorio`) | Se deciden midiendo la **raíz** con `ResizeObserver`, no con media queries: dentro del shell la app vive en una ventana, así que el viewport no dice nada útil. Se fuerza desde ⚙️ Configurar. |
| **Tipografía y botones XL** | En totem la escala salta (base 21 px, títulos 62 px) y todo objetivo táctil mide **≥76 px**. Verificado en la auditoría automática. |
| **Nada depende del hover** | Toda acción es un toque; el hover solo refuerza. |
| **Vuelve sola al inicio** | A los 90 s sin tocar (configurable, 15–600) regresa a *Ahora* y borra la consulta a medio responder. Sin esto el totem se queda en la pantalla que dejó la última persona. |
| **Sin estado personal** | Un totem es un dispositivo **compartido**. No hay «mis notas» ni «mi asistencia»: lo que se guarda es colectivo. |
| **QR en vez de enlaces** | Nadie escribe una URL en un totem. Cada perfil, sitio y la agenda `.ics` tienen su QR para saltar al teléfono. |

## Las seis secciones

1. **Ahora** — cuenta regresiva antes del evento; durante, la sesión en curso con
   barra de avance y la siguiente; después, cierre. Más fecha, sede y los QR de
   la landing y la agenda.
2. **Agenda** — los seis bloques de 08:30 a 11:30, con la sesión en curso
   resaltada, las pasadas atenuadas y las leyes que toca cada una.
3. **Expositores** — las cinco fichas; al tocarlas se abre la biografía y el QR
   a su perfil.
4. **Marco legal** — Ley 21.663 y Ley 21.719 explicadas.
5. **Consulta** — la parte consultiva: dos preguntas y una recomendación de qué
   sesiones ver, con quién conversar y qué ley revisar. Además el tablón de
   preguntas al panel y la encuesta de interés de la sala.
6. **NextTime** — quién organiza, los patrocinadores y quiénes participan.

## De dónde sale cada dato

| Contenido | Fuente |
|---|---|
| Cronograma, expositores, patrocinadores, landing, dirección de NextTime | Correo de José Gaete Sotomayor (CRO de NextTime Software) del 16-ago-2026, reenviado por José Ignacio Canales |
| Sede, fecha y textos de convocatoria | Campaña Mailchimp `b93cf0460e` |
| Fichas de expositores | Perfiles profesionales públicos; cada ficha declara su origen en pantalla |
| Leyes 21.663 y 21.719 | Fuentes públicas sobre ambas normas |
| Perfil de NextTime Software y de Nexsys | Perfiles corporativos públicos |

**Nada está inventado.** Donde no hubo fuente verificable no se rellenó: la
ficha de **Bernardo Donoso** no lleva biografía y lo dice explícitamente,
remitiendo al QR de su perfil, en vez de atribuirle un cargo que no se pudo
confirmar.

Dos afiliaciones aparecían en conflicto y así se resolvieron:

- **Lilian Jiménez** — la convocatoria decía «Chiqan Abogados»; el cronograma
  enlaza su perfil en **Nexo Abogados**. Manda el cronograma, por ser el dato
  más reciente y el que envió el organizador para el totem.
- **Leonardo Jadue** — la convocatoria lo daba como «Director Comercial,
  XGoldIT» y el cronograma lo pone exponiendo por **Lineage**. Su perfil público
  muestra ambas vinculaciones, así que la ficha dice *Director Comercial*, lo
  sitúa en la sesión de Lineage y menciona XGoldIT sin afirmar cuál es su
  empleador actual.

**Dato deliberadamente omitido:** el teléfono móvil de José Gaete venía en la
firma del correo. No se muestra: el totem es una pantalla pública en el hall de
un hotel. Si el organizador lo quiere visible, se añade en un minuto.

## Los QR

Los once QR se **precalculan en build** (paquete `qrcode`, corrección de errores
nivel M) y viajan embebidos como matrices de bits en base64: 2,7 KB para los
once. Así el totem no arrastra un generador ni depende de la red. Se rinden como
un único `<path>` SVG por código, agrupando cada racha horizontal de módulos.

Los once se verificaron **decodificándolos con `jsQR`** a la resolución a la que
se pintan: los once devuelven su URL exacta.

## Persistencia

`multiInstance: true`. Lo compartido —preguntas al panel y votos de la
encuesta— se guarda con `saveData` (debounce 600 ms) y se lee con `loadData`.
Lo transitorio (sección visible, ficha abierta, consulta a medias) **no se
guarda**: es estado del totem, no del documento.

Todo lo que entra pasa por `normalizar()`: ids desconocidos, votos negativos,
textos fuera de rango y entradas nulas se descartan.

```jsonc
{
  "votos": { "ley-marco": 7, "datos-personales": 11 },
  "preguntas": [{ "id": "q…", "texto": "…", "para": "lilian-jimenez", "ts": 1755… }]
}
```

## Preferencias (⚙️ Configurar)

| Campo | Por defecto | Efecto |
|---|---|---|
| `modo` | `auto` | Fuerza totem o escritorio; `auto` mide la raíz. |
| `segundosInactividad` | `90` | Cuánto espera antes de volver al inicio (15–600). |
| `acento` | `#05E0CE` | Pisa el cian de marca en caliente. |
| `mostrarFotos` | `true` | Fotos de los expositores o iniciales. |

## Agente IA (`agent.control`)

`getSnapshot()` devuelve el evento completo, la fase, la sesión en curso y la
siguiente, los seis bloques, los cinco expositores, las dos leyes, la ficha de
NextTime y el estado del público (preguntas y encuesta), más el aviso de que el
resumen legal no es asesoría.

| Tool | Payload |
|---|---|
| `IR_A_SECCION` | `{ seccion }` |
| `ADD_PREGUNTA` | `{ texto, speakerId? }` |
| `REMOVE_PREGUNTA` | `{ id }` |
| `VOTAR_TEMA` | `{ temaId }` |
| `RECOMENDAR` | `{ rol?, foco }` — solo lectura, devuelve la recomendación |
| `VOLVER_AL_INICIO` | `{}` |

## Aspecto: por qué se salta APP-SPEC §9

Igual que la v1, esta app **cablea colores propios a propósito**. Cambia la
paleta: la v1 replicaba el morado del correo de Mailchimp; la v2 adopta la
identidad corporativa de **NextTime Software**, tomada de los logos oficiales
que entregó el organizador.

| Token | Valor | Qué es |
|---|---|---|
| `--nt-navy` | `#070B33` | Azul marino del fondo de los logos |
| `--nt-navy-2` | `#0C1247` | Superficies |
| `--nt-cyan` | `#05E0CE` | Cian del isotipo, acento de marca |
| `--nt-soft` | `#E8ECF7` | Texto sobre navy |
| `--nt-evento` | `#8000D6` | Morado de la campaña, solo en el badge del evento |

Un totem no tiene modo día/noche que seguir, así que la paleta es fija. Del
tema del host se toman `--shadow-sm` / `--shadow-md`.

### El logo

El isotipo (cuadrado cian con la «t») está **reconstruido como SVG vectorial**
en el bundle: la red de la sesión bloquea `nexttimesoftware.com`, así que no se
pudieron descargar los archivos oficiales. La reconstrucción es geométrica y
escala bien, pero no está medida contra el original.

**Para sustituirlo por el archivo oficial:** deja el SVG/PNG en
`apps/evento-ciberseguridad/assets/` y cambia el componente `Isotipo` de
`dist/index.js` por un `<img src={shell.assetUrl('logo.svg')}>`. El resto de la
app no se entera. El wordmark «Nex**t**Time / Software» se compone con
tipografía del sistema, no con la fuente corporativa.

## Red

El bundle carga y funciona **sin red**: QR, logo y todo el contenido están
embebidos. Lo único remoto son las fotos de los expositores, que apuntan a las
URLs del correo original; si no cargan, cae a iniciales sin romperse.

## Verificación

```bash
node tools/check-versions.mjs evento-ciberseguridad
node tools/pack.mjs apps/evento-ciberseguridad
```

Lo comprobado en el último cambio:

- Smoke test: las seis secciones renderizan, los QR se pintan, el agente rechaza
  entradas inválidas, el totem vuelve solo al inicio sin llevarse los datos
  compartidos, y un documento corrupto no rompe la vista.
- Auditoría en Chromium a **1080×1920** (totem) y **1180×860** (ventana): sin
  errores de consola, sin desbordes horizontales, modo totem correcto y
  objetivo táctil mínimo de 76 px.

## Historial

| Versión | Cambios |
|---------|---------|
| 2.0.0 | Reescritura para totem y anfitrión consultivo. Identidad NextTime (navy + cian) con isotipo SVG. Cronograma completo de seis bloques con sesión en vivo. Cinco expositores con biografía investigada. Marco legal (Leyes 21.663 y 21.719). Consulta guiada con recomendación. Tablón de preguntas y encuesta colectivos. Once QR embebidos y verificados. Reinicio por inactividad. **Cambio de formato de datos:** el estado personal de la v1 (asistencia, notas, temas propios) desaparece; el documento ahora guarda `votos` y `preguntas`. |
| 1.0.0 | Primera versión: dashboard informativo con el estilo del correo de convocatoria, cuenta regresiva, temario, speakers, lugar y plan personal. |
