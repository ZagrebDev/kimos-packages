# 🎨 Marcas (app oficial)

**Versión actual: 1.0.0**

El sistema visual de la empresa, en una plana por marca: logotipos con el
fondo sobre el que van, paleta con roles, tipografías con su uso, ecosistemas
de aplicación y principios. Se edita aquí y se imprime desde aquí.

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

Más los datos de identidad —nombre, bajada, razón social, RUT, contacto, pie y
datos de pago— que usa Cotizaciones al emitir bajo esa marca.

## La hoja

Una plana por marca con las cinco secciones, pensada para imprimirse en A4
apaisado o mandarse como PDF a quien vaya a diseñar algo para la empresa.

Dos cosas la sostienen:

- **La misma hoja en pantalla y en papel.** La ventana de impresión renderiza
  el mismo componente con la misma hoja de estilos. No hay un maquetador para
  ver y otro para imprimir, que es como divergen.
- **Vacío es vacío.** Una sección que la marca no tiene no se pinta con un
  hueco: desaparece. Una hoja con cinco recuadros vacíos no comunica que la
  marca está a medias, comunica que el sistema está roto.

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
`AGREGAR_TIPOGRAFIA`, `AGREGAR_PRINCIPIO`, `GUARDAR_MARCA`, `ACTIVAR_MARCA`,
`REVISAR_MARCA`, `IMPRIMIR_HOJA`.

Nada se guarda hasta `GUARDAR_MARCA`, y con dos marcas del mismo nombre el
agente pide precisar en vez de elegir una: aplicar la marca equivocada sale
caro y en silencio.

## Desarrollo

```bash
node tools/build.mjs      # src/*.js → dist/index.js
node test/test-app.mjs    # 129 pruebas
```

Las fuentes viven en `src/` y se concatenan dentro del closure de
`mount(shell)`; el prefijo numérico fija el orden.

## Historial de versiones

| Versión | Qué trae |
|---|---|
| 1.0.0 | Primera versión: cartera de marcas sobre el registro de la plataforma; editor de identidad, paleta con roles, logotipos con fondo, tipografías con uso, ecosistemas y principios; hoja del sistema visual imprimible en A4 apaisado con secciones elegibles; avisos de lo que impide aplicar la marca (sin rol base, referencias rotas, acento sin contraste); subida de logotipos por `shell.files`; solo lectura sin `brand.write`; agente con paridad sobre la app. |
