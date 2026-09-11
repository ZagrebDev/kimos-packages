# 🎨 Marcas (app oficial)

**Versión actual: 1.1.0**

El sistema visual de la empresa, en **dos láminas** por marca. Se edita aquí
y se imprime desde aquí.

| Lámina | Responde | Qué lleva |
|---|---|---|
| **1 · Identidad** | Quién es esta marca | Logotipos con su fondo, paleta con roles, tipografías con su uso |
| **2 · Forma y aplicación** | Cómo se construye lo que se hace con ella | Esquinas, borde, elevación y densidad —con muestras reales— más ecosistemas y principios |

Son dos preguntas distintas y en una sola plana quedan las dos apretadas: la
de identidad se imprime y se cuelga, la de forma se consulta al construir.

## Lo que hay que entender antes de nada

**Las marcas no viven en esta app.** Viven en el registro de la plataforma, y
esta app es un editor y un visor.

```
REGISTRO (plataforma)              GESTIÓN (esta app, opcional)
/api/brands · shell.brands         crear, editar, la hoja imprimible
siempre disponible                 se instala solo si el tenant la necesita
```

Eso resuelve una tensión real: **no todo tenant quiere administrar marcas,
pero cualquier app tiene que poder usarlas.** Cotizaciones tiene que poder
emitir una propuesta con la marca correcta sin depender de que alguien haya
instalado este editor. Si las marcas vivieran en los items de esta app, no
podría.

Es el mismo reparto que `records`: la identidad en la plataforma, la ficha en
la app dueña. Aquí la app no es dueña de nada.

Consecuencia visible: el manifest declara `multiInstance: false` y la app no
usa `saveData` ni `shell.items`. No tiene estado propio que guardar.

## Qué es una marca aquí

Una marca no son dos colores y un logo. Para que **otra** app pueda producir
algo con ella sin adivinar, hace falta que los datos digan para qué sirve cada
cosa:

| Pieza | Lo que la hace utilizable |
|---|---|
| **Paleta** | Cada color lleva un **rol**: `Principal`, `Acento`, `Texto`, `Borde`, `Fondo`… Un color sin rol es decoración: Cotizaciones no sabrá cuál de seis usar en la cabecera. |
| **Logotipos** | Cada uno dice sobre qué **fondo** va (oscuro, claro, de color, cualquiera). Sin eso, una app puede poner el logo blanco sobre papel blanco. |
| **Tipografías** | Cada familia dice su **uso**: titulares, texto, datos. Y de dónde sale la fuente, porque quien la aplique tiene que poder cargarla. |
| **Ecosistemas** | Variantes de la **misma** marca (Retail y B2B, por ejemplo): comparten logotipo y tipografías y cambian qué color hace de base. Apuntan a la paleta por clave, así que si el color cambia, cambia en un solo sitio. |
| **Principios** | Las reglas en texto. Es lo que convierte el registro en un sistema visual consultable en vez de una tabla de colores. |
| **Forma** | Esquinas, radio, grosor del borde, elevación y densidad. Ver abajo: es la pieza que más rinde. |

Más los datos de identidad —nombre, bajada, razón social, RUT, contacto, pie y
datos de pago— que usa Cotizaciones al emitir bajo esa marca.

## La forma cambia TODO KIMOS, no solo esta app

Es lo que más rinde de la lámina 2, y conviene entender por qué.

En el tema de KIMOS, `rounded-*` y `shadow-*` de Tailwind cuelgan de `--radius`
y `--shadow-*`:

```
tailwind.config:  rounded-lg → var(--radius)     shadow-md → var(--shadow-md)
```

Y las apps derivan su propio radio de `var(--radius)`. Así que cuando una
marca define su forma, el host inyecta esos tokens y **cambian las esquinas
del escritorio, del chat del agente y de toda app que cumpla APP-SPEC §9, sin
tocar una línea en ninguna**.

No todo es gratis, y no tiene sentido fingir que sí:

| Token | Qué hace falta |
|---|---|
| `--radius`, `--shadow-*` | **Nada.** Funcionan hoy en todo el sistema. |
| `--border-width` | Que la app lea el token en vez de cablear `1px`. Mecánico. |
| `--font-sans`, `--font-mono` | Que la app lea el token en vez de cablear `'Inter'`. Mecánico. |
| `--brand-corner` (bisel), `--brand-density` | Que la app coopere de verdad. Se publican para quien los honre. |

**Plantillas de forma** —recta y plana, redondeada y suave, sin bordes,
editorial, cortada— rellenan los cinco campos de una vez. No son un sistema
aparte: son un punto de partida que después se ajusta. Y la muestra de cada
plantilla ES la plantilla, para verla antes de aplicarla.

Una marca que **no** declara forma no impone ninguna: manda el tema del
tenant. Es la misma regla que con los colores — lo que la marca no fija, no se
inventa.

## La hoja

Dos planas por marca, en A4 apaisado, para imprimir o mandar como PDF a quien
vaya a diseñar algo para la empresa. En pantalla se ve una cada vez; al
imprimir salen las dos, una por página.

Tres cosas la sostienen:

- **La misma hoja en pantalla y en papel.** La ventana de impresión renderiza
  el mismo componente con la misma hoja de estilos. No hay un maquetador para
  ver y otro para imprimir, que es como divergen.
- **Vacío es vacío.** Una sección que la marca no tiene no se pinta con un
  hueco: desaparece. Una hoja con cinco recuadros vacíos no comunica que la
  marca está a medias, comunica que el sistema está roto.

- **Una lámina vacía no se ofrece ni se imprime.** Una marca sin forma ni
  principios no tiene lámina 2, y el botón lo dice en vez de abrir una plana
  en blanco.

Qué secciones salen se elige con las casillas de arriba; las que la marca no
tiene aparecen desactivadas y explican por qué.

## Editar es un borrador

Cambiar una marca cambia cómo se ven las propuestas, las fichas y los correos
de **todas** las apps. Por eso nada se guarda al teclear: se edita un borrador,
se ve el resultado en la hoja, y se guarda cuando se pide. Descartar deja el
registro intacto.

Escribir exige dos cosas: que la app declare `brand.write` **y** que la
persona sea administradora. Sin lo segundo la app se abre igual, en solo
lectura — el permiso de una app nunca supera al de quien la usa.

## Avisos

La app dice lo que impide que la marca se aplique, sin bloquear el trabajo:

- Sin ningún color con rol **Principal**, las apps no sabrán cuál usar de base.
- Un ecosistema que apunta a un color que ya no está en la paleta.
- Un acento que no se distingue del principal (contraste bajo 3:1): un botón
  de acento sobre el fondo base va a desaparecer, y eso el ojo no lo ve venir
  mirando dos muestras separadas.

Son avisos, no errores: una marca a medio construir es un estado legítimo.

## Quién la usa

| App | Qué toma de la marca |
|---|---|
| **Cotizaciones** | Logo, colores y datos del emisor de cada propuesta |
| **ProductLab** | El estilo visual de un producto |
| Cualquier app con `brand.read` | `shell.brands.list()`, `.get(id)`, `.current()` |

Ver `APP-SPEC.md` §7.f.

## Permisos

| Permiso | Para qué |
|---|---|
| `brand.read` | Leer las marcas |
| `brand.write` | Crearlas y editarlas — solo esta app debería pedirlo |
| `files.write` | Subir los archivos de logotipo |
| `agent.control` | Las herramientas del agente |

## Agente IA

Las mismas acciones que la interfaz: `LISTAR_MARCAS`, `VER_MARCA`,
`ABRIR_MARCA`, `CREAR_MARCA`, `DUPLICAR_MARCA`, `ACTUALIZAR_IDENTIDAD`,
`AGREGAR_COLOR`, `ACTUALIZAR_COLOR`, `QUITAR_COLOR`, `AGREGAR_LOGO`,
`AGREGAR_TIPOGRAFIA`, `DEFINIR_FORMA`, `APLICAR_PLANTILLA_FORMA`,
`QUITAR_FORMA`, `AGREGAR_PRINCIPIO`, `GUARDAR_MARCA`, `ACTIVAR_MARCA`,
`REVISAR_MARCA`, `IMPRIMIR_HOJA`.

Nada se guarda hasta `GUARDAR_MARCA`, y con dos marcas del mismo nombre el
agente pide precisar en vez de elegir una: aplicar la marca equivocada sale
caro y en silencio.

## Desarrollo

```bash
node tools/build.mjs      # src/*.js → dist/index.js
node test/test-app.mjs    # 160 pruebas
```

Las fuentes viven en `src/` y se concatenan dentro del closure de
`mount(shell)`; el prefijo numérico fija el orden.

## Historial de versiones

| Versión | Qué trae |
|---|---|
| 1.1.0 | **La forma entra en la marca** y con ella la segunda lámina. Esquinas, radio, grosor del borde, elevación y densidad dejan de ser cosa de cada app: `--radius` y las sombras cuelgan de la marca en todo KIMOS, así que cambiarlas cambia el escritorio, el chat del agente y las demás apps sin tocar su código. Cinco plantillas de forma como punto de partida, con la muestra de cada una. La lámina 2 enseña componentes reales —botón, tarjeta, campo y burbuja de chat— porque «radio 0, sin sombra» no se entiende leyéndolo. Tres acciones nuevas del agente: `DEFINIR_FORMA`, `APLICAR_PLANTILLA_FORMA` y `QUITAR_FORMA`. Al imprimir salen las dos láminas, una por página. |
| 1.0.0 | Primera versión: cartera de marcas sobre el registro de la plataforma; editor de identidad, paleta con roles, logotipos con fondo, tipografías con uso, ecosistemas y principios; hoja del sistema visual imprimible en A4 apaisado con secciones elegibles; avisos de lo que impide aplicar la marca (sin rol base, referencias rotas, acento sin contraste); subida de logotipos por `shell.files`; solo lectura sin `brand.write`; agente con paridad sobre la app. |
