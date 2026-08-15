# Desayuno Ejecutivo de Ciberseguridad 2026

App informativa tipo dashboard para el **Desayuno Ejecutivo de Ciberseguridad
2026** de NextTime Software. Muestra toda la información del evento con la
identidad visual del correo de convocatoria, y añade una capa personal —
asistencia, temas de interés, speakers prioritarios, preguntas y notas — que se
guarda por instancia y que el agente IA puede operar.

**Versión actual: 1.0.0**

---

## De dónde sale el contenido

Todo lo que la app muestra está transcrito del correo de convocatoria de
NextTime Software (campaña Mailchimp `b93cf0460e`, *"Conoce a los expertos que
participarán en nuestro desayuno de ciberseguridad"*).

**Nada está inventado.** El correo no publica agenda hora por hora, hora de
término ni precio, así que la app **no los muestra ni los infiere**: para ese
detalle enlaza el archivo `.ics` oficial. La única cadena que no viene del
cuerpo del correo es el título largo (*"Adopta Ciberseguridad, prepárate para
Protección de Datos y Delitos Informáticos"*), tomado del nombre del propio
archivo de agenda enlazado desde el correo.

| Dato | Valor |
|---|---|
| Cuándo | Martes 18 de agosto de 2026, 08:30 hrs (hora de Chile) |
| Dónde | Hotel DoubleTree by Hilton — Av. Vitacura 2727, Las Condes |
| Organiza | NextTime Software · Ciclo de Eventos |
| Audiencia | Ejecutivos, líderes de negocio, tecnología, seguridad y cumplimiento |
| Speakers | Cristian Maulen (CustomerTrigger) · José Gaete (NextTime Software) · Leonardo Jadue (XGoldIT) · Lilian Jiménez (Chiqan Abogados) |
| Temas | 5 (Ley Marco, datos personales, incumplimiento, resiliencia, casos prácticos) |

La hora de inicio va con offset explícito (`2026-08-18T08:30:00-04:00`) para que
la cuenta regresiva sea correcta desde cualquier huso horario. Agosto cae antes
del cambio de hora chileno de septiembre, así que el offset es UTC-4.

## Qué hace

- **Cuenta regresiva en vivo** — días/horas/minutos/segundos, latiendo cada
  segundo y en pausa cuando la pestaña no se ve. Pasa sola a *En curso* a la
  hora de inicio y a *Finalizado* al terminar ese día.
- **Resumen** — los textos del correo, fichas de datos duros y el selector de
  asistencia (*Confirmo · Aún no lo sé · No podré asistir*).
- **Temario** — los 5 temas como lista marcable, con barra de progreso de tus
  temas de interés.
- **Speakers** — las 4 tarjetas con foto circular; toca una para marcarla como
  prioritaria. Si la foto no carga, cae a las iniciales.
- **Lugar** — sede, dirección, apertura en Google Maps y copiar al portapapeles.
- **Mi plan** — resumen de tus marcas, preguntas para llevar (opcionalmente
  dirigidas a un speaker, marcables como hechas) y notas libres.
- **Descarga agenda** — el `.ics` oficial, en la cabecera y en cada sección.

## Persistencia

`multiInstance: true`. El modelo completo se guarda con `saveData` (debounce de
600 ms) y se lee con `loadData` al montar. Todo lo que entra se sanea con
`normalizar()`: ids desconocidos, tipos raros y textos fuera de rango se
descartan, así un documento corrupto o un agente creativo no rompen la vista.

El cambio de pestaña **no** escribe en disco: es estado de vista.

```jsonc
{
  "tab": "resumen",
  "asistencia": "confirmada",          // | "tentativa" | "declinada" | null
  "temas": { "ley-marco": true },
  "prioritarios": { "jose-gaete": true },
  "preguntas": [{ "id": "q…", "texto": "…", "para": "lilian-jimenez", "hecha": false }],
  "notas": "…"
}
```

## Preferencias (⚙️ Configurar)

| Campo | Tipo | Por defecto | Efecto |
|---|---|---|---|
| `acento` | color | `#00E9D8` | Pisa el cyan del evento (`--ev-cyan`) en caliente. |
| `mostrarSegundos` | boolean | `true` | Muestra u oculta los segundos en la cuenta regresiva. |
| `mostrarFotos` | boolean | `true` | Fotos de los speakers o iniciales. |

## Agente IA (`agent.control`)

`getSnapshot()` devuelve la versión, la ficha completa del evento, la fase
(`proximo` / `en-curso` / `finalizado`), cuánto falta, el temario y los speakers
con su marca, y el plan del usuario con los ids de cada pregunta.

| Tool | Payload |
|---|---|
| `SET_ASISTENCIA` | `{ estado: "confirmada" \| "tentativa" \| "declinada" }` |
| `TOGGLE_TEMA` | `{ temaId }` |
| `TOGGLE_SPEAKER_PRIORITARIO` | `{ speakerId }` |
| `ADD_PREGUNTA` | `{ texto, speakerId? }` |
| `REMOVE_PREGUNTA` | `{ id }` |
| `SET_NOTAS` | `{ texto }` |
| `IR_A_SECCION` | `{ tab }` |

Todas las entradas se validan contra los ids reales; una acción inválida
devuelve `{ success: false, error }` sin tocar el modelo. La UI y el agente
llaman a **las mismas** funciones, así que la ventana se repinta sola cuando el
agente actúa.

## Aspecto: por qué esta app se salta APP-SPEC §9

`APP-SPEC.md` §9 pide que las apps no cableen colores propios y salgan de los
tokens del tema del host. **Esta app los cablea a propósito**: es una app de
marca, y la identidad visual del evento *es* el contenido, no decoración. Los
valores salen tal cual del correo:

| Token | Valor | De dónde |
|---|---|---|
| `--ev-morado` | `#8000D6` | fondo de `<body>` / `#bodyTable` |
| `--ev-morado-2` | `#9829ED` | fondo de los `.mceWrapperInner` |
| `--ev-cyan` | `#00E9D8` | fondo de los botones *DESCARGA AGENDA* |
| `--ev-soft` | `#F9F9F9` | color de `.mceText p` |
| tipografía | Helvetica Neue / Helvetica / Arial / Verdana | `font-family` del correo |

También se conservan del correo el espaciado de letras de los títulos (5 px en
los `h3` tipo *SPEAKERS*, 3 px en los `h4` y en los botones), el radio de 8 px
de los botones, los avatares circulares y el ancho de maqueta de 660 px.

Del tema del host sí se toman `--shadow-sm` / `--shadow-md`, y el acento del
usuario puede pisar el cyan vía ⚙️ Configurar. La app se ve igual en modo día y
en modo noche —igual que el correo— porque el lienzo morado es el mismo en
ambos.

## Red

El bundle carga y funciona **sin red**: no importa dependencias en runtime y
todo el contenido está embebido. Lo único remoto son las fotos de los speakers
y los dos logos, que apuntan a las URLs originales del correo; si no cargan, la
app cae a iniciales y a texto sin romperse.

## Verificación

```bash
node tools/check-versions.mjs evento-ciberseguridad
node --input-type=module -e "import('./apps/evento-ciberseguridad/dist/index.js').then(m => console.log(typeof m.default))"
node tools/pack.mjs apps/evento-ciberseguridad
```

## Historial

| Versión | Cambios |
|---------|---------|
| 1.0.0 | Primera versión: cuenta regresiva en vivo, 5 pestañas (Resumen, Temario, Speakers, Lugar, Mi plan), asistencia, temas de interés, speakers prioritarios, preguntas, notas, agente IA con 7 tools y preferencias ⚙️. |
