# Anfitrión · Desayuno Ejecutivo de Ciberseguridad 2026

Anfitrión interactivo optimizado para **Totem Touch** y para el **modo vitrina vertical (9:16)** de Kimos Enterprise, del Desayuno Ejecutivo de Ciberseguridad 2026 de NextTime Software. 

**Versión actual: 2.2.0**

---

## Características de Diseño Touch

| Decisión | Por qué |
|---|---|
| **Navegación Superior Táctil XL** | Botones situados arriba (debajo del header) para evitar cualquier superposición con el widget de chat/asistente de IA situado en la parte inferior de la pantalla. |
| **Iconos 100% Blancos (Monocolor)** | Iconos vectoriales SVG nítidos y elegantes que garantizan alto contraste y legibilidad inmediata sobre fondos violeta/índigo. |
| **Agenda y Expositores Integrados** | Vista unificada donde cada bloque del programa incorpora las fotografías de los expositores, biografía completa, roles, empresas y código QR directo a su perfil. |
| **Paleta Idéntica al Landing** | Fondo con el degradado de las secciones del landing (`#4600F8` → `#7600CF`), tarjetas en el secundario `#040932`, acento cian `#00E4D0`, tipografía **Poppins** y texto blanco. |
| **Navegación que Cabe en 9:16** | En vertical los cuatro accesos pasan a una rejilla de cuatro columnas con el icono sobre el rótulo y el texto en dos líneas: ya no se recortan «Agenda y Expositores» ni «Consulta e Interacción», y desaparece el desplazamiento lateral. |
| **Pie Corporativo** | Réplica de la banda de cierre del landing (fondo cian `#00E4D0`) con tipografía **blanca**, el copyright de NextTime Software y el crédito **Powered by Kimos.dev** con el logotipo de Kimos vectorizado. |
| **Zona Libre para el Dock de Voz** | En vertical el cuerpo reserva 280 px al pie para que el micrófono flotante de la vitrina no tape el final del contenido. |
| **Header Ampliado con Logo Oficial** | Identidad corporativa de NextTime Software reforzada en la cabecera junto al reloj digital y badge en vivo. |
| **Retorno Automático al Inicio** | A los 90 s de inactividad (configurable) el totem regresa a la pantalla *Ahora* para el siguiente asistente. |

---

## Estructura de Secciones

1. **Ahora** — Cuenta regresiva antes del evento; durante la jornada muestra la sesión en curso con barra de progreso y la siguiente ponencia.
2. **Agenda y Expositores** — Cronograma de 08:30 a 11:30 con las 6 ponencias, etiquetas de leyes aplicables y las fichas completas de los expositores (fotos, biografías verificadas y QR individual).
3. **Marco Legal** — Resumen estructurado y puntos clave de cumplimiento de la **Ley 21.663** (Ley Marco de Ciberseguridad) y la **Ley 21.719** (Protección de Datos Personales).
4. **Consulta e Interacción** — Diagnóstico consultivo interactivo con recomendaciones por rol y desafío, tablón de preguntas para el panel y encuesta de temas en tiempo real.

---

## Cambios de la versión 2.2.0

- **Estilo alineado al landing oficial.** El fondo pasa del degradado radial
  oscuro al degradado violeta→magenta de las secciones del landing
  (`linear-gradient(#4600F8 → #7600CF)`); las tarjetas usan el color secundario
  `#040932` con la misma sombra (`0 0 10px rgba(0,0,0,.5)`), el texto es blanco
  y el acento sigue siendo `#00E4D0`. Tipografía Poppins en toda la app.
- **Navegación superior legible en vertical.** En modo totem/vitrina los botones
  se disponen en rejilla con el icono arriba y el rótulo debajo (dos líneas si
  hace falta). Bajo 720 px de ancho la rejilla pasa a 2×2.
- **Pie nuevo.** Banda cian del landing con tipografía blanca:
  `© 2026 NextTime Software` · `Powered by KIMOS.dev`, con el logotipo de Kimos
  incrustado como SVG (trazado desde `kimos-enterprice/frontend/public/logos/KIMOS.png`,
  sin dependencias externas ni peticiones de red).
- **Espacio para el dock de voz.** En vertical el cuerpo reserva 280 px
  inferiores, la altura que ocupa el micrófono flotante de la vitrina.

> Nota de contraste: el pie usa tipografía blanca sobre el cian `#00E4D0` por
> pedido expreso. Es una combinación de bajo contraste, así que se compensa con
> peso 600 y una sombra sutil (`0 1px 2px rgba(4,9,50,.45)`). Si en el totem se
> ve poco legible, basta cambiar `.ec-ft { color }` a `#040932`.
