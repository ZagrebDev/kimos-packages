# Qué se adoptó de ONLYOFFICE y LibreOffice, y qué no

Revisión de los dos repositorios pedidos, decisión de qué se puede traer, y qué
se trajo de verdad en la v1.2.0.

---

## 1. Lo primero: la licencia decide la estrategia

No es un detalle legal a pie de página; es lo que determina qué se podía hacer.

| Proyecto | Licencia | Qué implica para una app de KIMOS |
|---|---|---|
| **ONLYOFFICE** — DocSpace-server, DocSpace-client, DocumentServer, office-js-api, docspace-ui-kit-react | **AGPL-3.0** | Copiar código **contagiaría el AGPL a toda la app**, y al servirse por red obligaría a publicar el fuente de KIMOS. Inviable |
| ONLYOFFICE — document-editor-react, docspace-sdk-js, docspace-plugin-sdk, document-formats | Apache-2.0 | Reutilizable, pero son *conectores* a un DocumentServer que hay que desplegar aparte |
| **LibreOffice core** | **MPL-2.0** (con LGPLv3 heredado) | Copiar un archivo obliga a mantenerlo bajo MPL y a publicar sus cambios. Además son ~149 000 archivos de C++ |

Y sobre todo, el contrato de la plataforma: una app de KIMOS es **un bundle ESM
autocontenido, sin dependencias, que usa el React del host** (APP-SPEC §3).
Ni el `sdkjs` de ONLYOFFICE ni un solo módulo de LibreOffice caben ahí.

> **Conclusión.** «Clonar» los repositorios en sentido literal no era viable ni
> legal. Lo que sí se puede adoptar —y es lo que de verdad aporta— son **los
> formatos y los comportamientos**: un formato de archivo es un estándar
> abierto, y una idea de interfaz no se registra. Eso es lo que se hizo, y está
> escrito desde cero.

Lo que se clonó fue **para estudiarlo**: `github.com/LibreOffice/core` en
superficial (`--depth 1 --filter=blob:none --sparse`), del que se sacaron dos
cosas concretas:

- `schema/odf1.3/OpenDocument-v1.3-schema.rng` — el **esquema RelaxNG oficial de
  OASIS**, que ahora valida nuestra exportación en las pruebas.
- `filter/source/odfflatxml/` — confirma que el ODF plano es un filtro de
  primera clase, y de paso que el camino elegido es el que usa LibreOffice.

---

## 2. La matriz: adoptar · adaptar · descartar

### ✅ Adoptado en la v1.2.0

| De dónde | Qué | Cómo se hizo aquí |
|---|---|---|
| **LibreOffice** (formato ODF / OASIS) | **Exportar e importar .ods, .odt y .odp** | `src/22-odf.js`: escritor y lector ZIP propios, lector XML propio, ODF 1.3 desde la especificación. **Validado contra el esquema RelaxNG de OASIS** |
| **LibreOffice** (OpenFormula, ODF parte 2) | Las fórmulas viajan de verdad, no como texto | `toOpenFormula` / `fromOpenFormula`: `=SUMA(B2:B3)` ⇄ `of:=SUM([.B2:.B3])`, con los nombres traducidos al inglés canónico |
| **LibreOffice** (Herramientas ▸ Corrección automática) | **Autocorrección tipográfica** en español | `src/14-autocorrect.js`: comillas curvas, …, —, ×, ½, ordinales `1.º`. Tabla propia; nunca toca código ni URLs; se apaga en ⚙️ |
| **ONLYOFFICE** (interfaz de sus editores) | **Cinta de opciones con pestañas y grupos**, plegable | `src/12-ribbon.js`, aplicada a Documentos y Hojas |
| **ONLYOFFICE / Calc** | **Ordenar por columna** e **inmovilizar la primera fila** | En la hoja, pestaña Datos y pestaña Ver |
| **Ambos** | Botón de **Importar** en el Inicio | Abrir un `.ods`/`.odt`/CSV hecho fuera, sin salir de KIMOS |

### 🔁 Adaptado, no copiado

| Idea original | Por qué no tal cual | Qué se hizo |
|---|---|---|
| Autocorrección con las tablas de `extras/source/autocorr/` | Son MPL-2.0 y están atadas a su motor; además traen miles de entradas de ortografía que aquí sobran | Tabla propia de ~18 reglas tipográficas, la que se nota al escribir en castellano |
| Cinta con cientos de controles | Nuestra app vive en una **ventana del escritorio**, a veces estrecha | Cuatro pestañas por módulo, grupos con etiqueta, y plegado; a 900 px se queda solo con los iconos |
| ODF con compresión deflate | Habría que traer una librería de compresión al bundle | ZIP «store» (sin comprimir), que el estándar admite y todos los lectores abren |

### ❌ Descartado, y por qué

| Idea | Motivo |
|---|---|
| Integrar **ONLYOFFICE DocumentServer** (vía `document-editor-react`) | Es un servicio aparte que hay que desplegar y licenciar; metería un segundo editor, un segundo almacenamiento y un segundo modelo de permisos dentro de KIMOS. Rompería el deslinde que sostiene toda la app: una fuente de verdad por dato |
| Copiar el **motor de fórmulas** de Calc (`sc/`) | C++ y MPL. El nuestro ya cubre 56 funciones y está probado; lo que faltaba era el *formato de intercambio*, y eso es lo que se añadió |
| **Control de cambios** y comentarios estilo ONLYOFFICE | Interesante, pero sin canal de *push* del servidor la colaboración es por sondeo (APP-SPEC §5.1): un control de cambios que llega con 20 s de retraso engaña más que ayuda. Anotado para cuando la plataforma tenga suscripción a cambios |
| **Macros/Basic** de LibreOffice | Ejecutar un lenguaje de macros en la sesión del usuario es justo lo que evita `docs/SEGURIDAD.md`. El agente IA cubre la automatización sin ejecutar código ajeno |
| Leer/escribir **.docx, .xlsx, .pptx** | OOXML necesita bastante más superficie (y compresión real). Hoy se rechaza con un mensaje que dice qué hacer: abrirlo en LibreOffice u ONLYOFFICE y guardarlo como ODF |
| **ODF plano** (`.fodt`/`.fods`) | LibreOffice lo abre, pero ONLYOFFICE y Excel no. Se eligió el ODF empaquetado, que abren los cuatro |

---

## 3. Qué significa esto para quien usa la app

Antes de la v1.2.0, un documento de WorkOffice solo salía como Markdown, CSV o
PDF impreso. Ahora:

- **Sale y entra** en `.ods`, `.odt` y `.odp`: los formatos que abren
  LibreOffice, ONLYOFFICE, Microsoft Office y Google Workspace.
- Una hoja exportada **conserva sus fórmulas**, no solo los resultados: quien la
  abra en Calc o en Excel puede seguir trabajando con ella.
- Un `.ods` que alguien mande por correo se abre en KIMOS con doble clic desde
  el Inicio, con sus fórmulas convertidas a las nuestras.

El requisito original del equipo —«nube y local»— queda cerrado por los dos
extremos: los documentos viven en KIMOS, y salen en un formato estándar que no
los deja atrapados.

---

## 4. Cómo se verifica que el ODF es correcto

No basta con que el archivo se genere; tiene que **abrirse en otro programa**.
La prueba (`test/odf.test.mjs`, 26 casos) comprueba:

1. Que el paquete sea un ZIP válido según `unzip -t` — un lector ajeno al nuestro.
2. Que `mimetype` vaya **primero y sin comprimir** (OpenDocument §3.3). Si esto
   falla, ningún programa lo reconoce.
3. Que `content.xml` **valide contra el esquema RelaxNG oficial de OASIS** para
   ODF 1.3, con `xmllint --relaxng`, en los tres formatos.
4. Que exportar e importar devuelva los mismos valores, fórmulas y fechas.
5. Que el texto del usuario se escape (`&`, `<`) y que el lector XML **rechace
   un DOCTYPE**, cerrando la expansión de entidades.

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/LibreOffice/core.git
cd core && git sparse-checkout set --no-cone '/schema/odf1.3/*'
ODF_SCHEMA=$PWD/schema/odf1.3/OpenDocument-v1.3-schema.rng node test/odf.test.mjs
```

**Lo que no se pudo verificar aquí, dicho claramente**: en este contenedor hay
un LibreOffice 24.2, pero su modo `--headless` no carga archivos (falla con
«source file could not be loaded» con cualquier entrada), así que **no se pudo
abrir un archivo generado en LibreOffice de verdad**. La validación es contra el
esquema oficial y contra nuestro propio lector, que son fuertes pero no
sustituyen a la prueba de abrirlo. Conviene que alguien haga esa comprobación
manual una vez antes de anunciarlo a los usuarios.

---

## 5. Qué se propone para la siguiente

Por orden de valor sobre esfuerzo:

1. **OOXML de lectura** (`.xlsx` y `.docx`): el ZIP y el lector XML ya están
   escritos; falta el mapeo de sus esquemas. Es la petición que más va a llegar.
2. **Imágenes dentro del ODF**: hoy un documento con imágenes exporta el pie y
   el nombre del archivo. Empaquetar el binario en `Pictures/` del ODF es
   directo ahora que los adjuntos viven en el Cloud Storage.
3. **Control de cambios**, cuando la plataforma tenga notificación de cambios
   (ver `docs/INTEGRACION-KIMOS.md` §5).
4. **Formato condicional** en la hoja: es lo que más se echa de menos al venir
   de Excel o Calc.
