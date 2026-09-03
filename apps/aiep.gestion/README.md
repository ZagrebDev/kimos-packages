# AIEP GESTIÓN

Asistencia del Seminario **«IA y Protección de Datos: Lo que Todo Negocio Debe
Saber para No Quedarse Atrás»**, en la Sede AIEP San Joaquín, organizado con los
Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e Independencia.

**Versión actual: 3.1.0**

Es el lado interno del par: los totem de **AIEP INSCRIPCIÓN** acreditan gente en
la puerta, y aquí se ve quién llegó.

---

## De dónde salen los datos

Los totem corren en la **vitrina**, donde no hay sesión, así que envían por el
**gateway público** del creator pack. El gateway deja cada envío como un item
`kind: "submission"` del canal `asistencia` de esta instancia, y aquí se leen
con `shell.items.list()`. La lista se refresca sola cada 15 segundos.

Como el gateway **sanea a texto plano y descarta lo anidado**, el totem manda un
**lote de personas como un campo de texto con JSON dentro**, que aquí se vuelve
a abrir. También se acepta un envío de **una sola persona**, por si alguien
postea a mano contra el endpoint. Y un lote ilegible no tira el envío entero:
aparece como `(lote ilegible)` para que se revise.

## No hay ningún interruptor que pulsar

El gateway solo acepta envíos si la instancia declaró `public.enabled` en su
item `definition`. **Esta app lo escribe sola al abrirse** — antes había que
activarlo a mano, y no tenía sentido.

Lo que `/definition` expone al mundo es solo el bloque `data`, y ahí **no va
ningún dato personal**: nombre del evento, fecha, sede y canal.

## El único paso que queda: conectar el totem

El endpoint del gateway se direcciona **por instancia**, así que el totem tiene
que saber cuál es esta, y no hay forma de que la descubra solo — corre en la
vitrina, sin sesión iniciada, y no puede preguntarle a la plataforma cuál de las
apps de gestión es la tuya.

**El código está en la sección «🔗 Conectar totem»** de esta app: es el
identificador de la instancia (algo como `aiep.gestion-518a2337`). Se pega al
final de la URL de la vitrina donde corre AIEP INSCRIPCIÓN, una sola vez:

```
https://tu-kimos/vitrina/abc123           ← la URL de la vitrina del totem
https://tu-kimos/vitrina/abc123?aiep=CÓDIGO   ← la que se abre en el totem
```

El totem lo guarda en ese equipo, así que una recarga sin el parámetro no lo
deja huérfano. Si hay varios totem, **todos llevan el mismo código**.

Esa sección **no desaparece nunca**: hace falta cada vez que se suma un totem o
se reinstala el navegador del kiosco. El agente también sabe decirlo, con
`CODIGO_PARA_EL_TOTEM`.

---

## Qué muestra

| Sección | Qué hay |
|---|---|
| **Asistencia** | Cifras en cabecera (asistieron, faltan, envíos recibidos, marcados a mano) con barra de avance, y la lista completa: buscar por nombre, empresa o RUT, filtrar por Centro de Negocios, ver solo quienes faltan, ordenar y marcar a mano. |
| **Por centro** | Cómo va cada Centro de Negocios, con su porcentaje y accesos directos a su gente y a quiénes le faltan. |
| **Conectar totem** | El código de esta instancia y dónde pegarlo. No hay nada que activar: es la ficha de referencia, y está siempre. |

En la cabecera: **⟳** relee ahora mismo y **⬇ CSV** descarga la lista con el
filtro que tengas puesto. El CSV se arma en el navegador —no sale de la máquina
de quien lo pide— e incluye por qué totem entró cada persona.

---

## Cómo se cruza el padrón

- Una persona puede aparecer **varias veces** (se acreditó dos veces, o entró
  por dos totem). Se queda la **primera marca**, que es la hora real de llegada;
  las demás se cuentan aparte como repeticiones. Nada se borra.
- El **marcado manual** —para quien llegó sin estar inscrito, o se acreditó en
  el mesón— es **reversible y queda con nota**. Se distingue en pantalla de lo
  que registró el totem, y **no puede sobrescribirlo**: lo del totem es el acta
  de lo que pasó. Esta es la única vía para dar por asistida a una persona que
  no está en el padrón; el totem no la ofrece.

El padrón embebido es el mismo de AIEP INSCRIPCIÓN, copiado literalmente para
que las dos apps cuenten sobre la misma base. Su procedencia y las reparaciones
que se le hicieron están en
[`apps/aiep.inscripcion/README.md`](../aiep.inscripcion/README.md).

---

## Aspecto

Comparte el chrome con ANFITRIÓN AIEP y AIEP INSCRIPCIÓN —misma paleta, misma
cabecera, misma barra bajo el header, mismo pie con el logotipo de Kimos— para
que las tres se lean como un solo sistema. Lo que cambia es el cuerpo: esto no
se usa de pie frente a un totem, sino sentado en una ventana, así que manda la
tabla.

---

## El agente

| Herramienta | Qué hace |
|---|---|
| `RESUMEN` | Cuántos llegaron, cuántos faltan, cómo va cada centro y qué totem están acreditando. |
| `BUSCAR` | Por nombre, empresa o RUT; deja la lista filtrada en pantalla. |
| `FILTRAR` | Por Centro de Negocios y/o solo quienes faltan. |
| `MARCAR_ASISTENCIA` | Marca (o desmarca) a mano. **Se niega** si el totem ya registró a esa persona. |
| `CODIGO_PARA_EL_TOTEM` | Deja en pantalla el código de esta instancia y dónde pegarlo. |
| `IR_A_SECCION` · `REFRESCAR` | Navegación y relectura. |

En el snapshot se le advierte de lo que tiene delante: **son datos personales**
—RUT, correos, empresas—, no debe recitarlos sin que se los pidan para el
trámite en curso, y **no puede borrar ni editar** lo que registró el totem.

---

## Puesta en marcha

1. Instalar esta app y abrirla **como documento** (menú 🗂️ → Nuevo). Sin instancia no hay código. La recepción se abre sola.
2. Ir a **🔗 Conectar totem**, copiar el código y pegarlo al final de la URL de la vitrina del totem, como `?aiep=CÓDIGO`.
3. Abrir esa URL en el totem y acreditar a una persona de prueba.

---

## Historial

| Versión | Cambios |
|---|---|
| 3.1.0 | **El código deja de esconderse.** En la 3.0.0 solo aparecía en una tarjeta que se ocultaba con la primera acreditación, así que no había forma de recuperarlo para sumar un segundo totem o tras reinstalar el navegador del kiosco. Ahora vive en su propia sección **🔗 Conectar totem**, permanente, con el ejemplo de la URL completa y la explicación de por qué hace falta. El agente lo sabe decir con `CODIGO_PARA_EL_TOTEM`. |
| 3.0.0 | **Vuelve el gateway, sin el interruptor.** La 2.0.0 leía los totem con `shell.data`, que solo funciona si el totem corre en sesión; en la vitrina devuelve vacío siempre. Se vuelve a recibir por el gateway público, pero **la recepción se abre sola al abrir la app**: ya no hay nada que activar. Queda un único paso, `?aiep=ID` en la URL de la vitrina, que la app muestra listo para copiar y esconde con la primera acreditación. |
| 2.0.0 | Sin configurar nada, leyendo los totem con `shell.data` — **solo válido si el totem corre en sesión**. Fuera la sección Publicación entera —el interruptor de recepción, el identificador de instancia y los cuatro pasos de emparejamiento—: ahora encuentra sola todos los totem con `shell.data` y suma lo de todos. La cabecera muestra cuántos totem están acreditando y con cuántas personas cada uno, y el CSV pasa a la cabecera. |
| 1.0.0 | Primera versión: cruce en vivo del padrón con los envíos de los totem por el gateway público, cifras y barra de avance, búsqueda y filtros, avance por Centro de Negocios, marcado manual, publicación opt-in y exportación a CSV. |
