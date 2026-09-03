# AIEP GESTIÓN

Asistencia del Seminario **«IA y Protección de Datos: Lo que Todo Negocio Debe
Saber para No Quedarse Atrás»**, en la Sede AIEP San Joaquín, organizado con los
Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e Independencia.

**Versión actual: 1.0.0**

Es el lado interno del par: los totem de **AIEP INSCRIPCIÓN** acreditan gente en
la puerta, y aquí se ve quién llegó.

---

## Qué muestra

| Sección | Qué hay |
|---|---|
| **Asistencia** | Cifras en cabecera (asistieron, faltan, llegaron sin inscripción previa, envíos recibidos) con barra de avance, y la lista completa: buscar por nombre, empresa o RUT, filtrar por Centro de Negocios, ver solo quienes faltan, ordenar, y marcar a mano. |
| **Por centro** | Cómo va cada Centro de Negocios, con su porcentaje y accesos directos a su gente y a quiénes le faltan. |
| **Publicación** | El interruptor de la recepción, el identificador de la instancia para pegar en los totem, los cuatro pasos del emparejamiento y la exportación a CSV. |

La lista se refresca sola cada 15 segundos.

---

## De dónde salen los datos

El gateway público de la plataforma (`APP-SPEC` §7.b) guarda cada envío del
totem como un item `kind: "submission"` del canal `asistencia` de esta
instancia, y la app los lee con `shell.items.list()`.

Como el gateway **sanea los valores a texto plano y descarta lo anidado**, el
totem manda un **lote de personas como un campo de texto con JSON dentro**, que
aquí se vuelve a abrir. También se acepta un envío de **una sola persona**, por
si alguien postea a mano contra el endpoint: ese registro no debe caerse en
silencio. Y si un lote llega ilegible, no se descarta el envío entero: aparece
como `(lote ilegible)` para que el operador sepa que existe y hay que mirarlo.

### La recepción es opt-in

Mientras no se active en **Publicación**, el gateway responde **403** y no entra
nada. Activarla escribe el bloque `public` en el item `definition`, que es lo
que la plataforma mira:

```jsonc
"public": {
  "enabled": true,
  "channels": ["asistencia"],
  "data": { "evento": "…", "fecha": "…", "sede": "…", "canal": "asistencia", "inscritos": 112 }
}
```

El bloque `data` —lo único que `/definition` expone al mundo— **no lleva ningún
dato personal**: solo el nombre del evento, la fecha, la sede y el total de
inscritos.

> Si la recepción está apagada, el totem **no pierde a nadie**: guarda las
> acreditaciones y las sube en cuanto se enciende. Avisa al operador de que hay
> registros esperando.

---

## Cómo se cruza el padrón

- Una persona puede aparecer **varias veces** (se acreditó dos veces, o entró
  por dos totem). Se queda la **primera marca**, que es la hora real de llegada;
  las demás se cuentan aparte como repeticiones. Nada se borra.
- Quien **llegó sin estar en el padrón** se muestra igual, marcado como «Sin
  inscripción». No se esconde a nadie que asistió por no venir en la planilla.
- El **marcado manual** (para quien se acreditó en el mesón, sin totem) es
  **reversible y queda con nota**. Se distingue en pantalla de lo que registró
  el totem, y **no puede sobrescribirlo**: lo del totem es el acta de lo que
  pasó.

El padrón embebido es el mismo de AIEP INSCRIPCIÓN, copiado literalmente para
que las dos apps cuenten sobre la misma base. Su procedencia y las reparaciones
que se le hicieron están documentadas en
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

Cuenta, busca y filtra, y deja el resultado en pantalla.

| Herramienta | Qué hace |
|---|---|
| `RESUMEN` | Cuántos llegaron, cuántos faltan y cómo va cada centro. |
| `BUSCAR` | Por nombre, empresa o RUT; deja la lista filtrada en pantalla. |
| `FILTRAR` | Por Centro de Negocios y/o solo quienes faltan. |
| `MARCAR_ASISTENCIA` | Marca (o desmarca) a mano. **Se niega** si el totem ya registró a esa persona. |
| `IR_A_SECCION` · `REFRESCAR` | Navegación y relectura. |

En el snapshot se le advierte de lo que tiene delante: **son datos personales**
—RUT, correos, empresas—, no debe recitarlos sin que se los pidan para el
trámite en curso, y **no puede borrar ni editar** lo que registró el totem.

---

## Puesta en marcha

1. Instalar esta app y crear el documento del seminario (🗂️ Nuevo).
2. **Publicación → Activar recepción.**
3. Copiar el identificador de la instancia y pegarlo en cada totem
   (⚙️ Configurar → «Instancia de AIEP GESTIÓN»), o pasarlo como `?aiep=ID` en
   la URL de la vitrina.
4. Acreditar a una persona de prueba y comprobar que aparece aquí.

---

## Historial

| Versión | Cambios |
|---|---|
| 1.0.0 | Primera versión: cruce en vivo del padrón con los envíos de los totem, cifras y barra de avance, búsqueda y filtros, avance por Centro de Negocios, marcado manual reversible que no pisa lo del totem, publicación opt-in del canal `asistencia`, exportación a CSV y agente de consulta. |
