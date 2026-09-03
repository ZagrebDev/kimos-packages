# AIEP GESTIÓN

Asistencia del Seminario **«IA y Protección de Datos: Lo que Todo Negocio Debe
Saber para No Quedarse Atrás»**, en la Sede AIEP San Joaquín, organizado con los
Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e Independencia.

**Versión actual: 2.0.0**

Es el lado interno del par: los totem de **AIEP INSCRIPCIÓN** acreditan gente en
la puerta, y aquí se ve quién llegó.

---

## No hay nada que configurar ni que activar

La app **encuentra sola todos los totem**. Declara
`data.read:aiep.inscripcion` en su manifest, y con eso
`shell.data.listInstances('aiep.inscripcion')` le devuelve cada instancia del
totem a la que el usuario ya tiene acceso, y `listItems` sus acreditaciones. Si
hay tres totem en la puerta, los tres se suman.

Sin emparejar, sin identificadores que pegar, sin interruptores. Se instala, se
abre y ya está mostrando lo que hay. La lista se refresca sola cada 15 segundos.

El techo lo pone el **RBAC del usuario**, no esta app: solo se ven los totem de
equipos a los que la persona ya pertenece, y solo de lectura.

---

## Qué muestra

| Sección | Qué hay |
|---|---|
| **Asistencia** | Cifras en cabecera (asistieron, faltan, cuántos totem están acreditando y con cuántos cada uno, marcados a mano) con barra de avance, y la lista completa: buscar por nombre, empresa o RUT, filtrar por Centro de Negocios, ver solo quienes faltan, ordenar y marcar a mano. |
| **Por centro** | Cómo va cada Centro de Negocios, con su porcentaje y accesos directos a su gente y a quiénes le faltan. |

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
| `IR_A_SECCION` · `REFRESCAR` | Navegación y relectura. |

En el snapshot se le advierte de lo que tiene delante: **son datos personales**
—RUT, correos, empresas—, no debe recitarlos sin que se los pidan para el
trámite en curso, y **no puede borrar ni editar** lo que registró el totem.

---

## Puesta en marcha

1. Instalar AIEP INSCRIPCIÓN y abrirla en el equipo de la puerta.
2. Instalar esta app y abrirla.
3. Listo.

---

## Historial

| Versión | Cambios |
|---|---|
| 2.0.0 | **Sin configurar nada.** Fuera la sección Publicación entera —el interruptor de recepción, el identificador de instancia y los cuatro pasos de emparejamiento—: ahora encuentra sola todos los totem con `shell.data` y suma lo de todos. La cabecera muestra cuántos totem están acreditando y con cuántas personas cada uno, y el CSV pasa a la cabecera. |
| 1.0.0 | Primera versión: cruce en vivo del padrón con los envíos de los totem por el gateway público, cifras y barra de avance, búsqueda y filtros, avance por Centro de Negocios, marcado manual, publicación opt-in y exportación a CSV. |
