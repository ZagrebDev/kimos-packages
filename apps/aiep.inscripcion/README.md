# AIEP INSCRIPCIÓN

Totem de **acreditación por RUT** del Seminario **«IA y Protección de Datos: Lo
que Todo Negocio Debe Saber para No Quedarse Atrás»**, en la Sede AIEP San
Joaquín, organizado con los Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e
Independencia.

**Versión actual: 3.0.0**

---

## Qué hace

El asistente llega, toca **Acreditarme**, marca su RUT en el teclado de la
pantalla, confirma que es él y queda registrado. Eso es todo.

| Caso | Qué ve |
|---|---|
| Está en la lista | Su nombre, empresa y Centro de Negocios, para que confirme |
| **No está en la lista** | «No estás en la lista. Acércate al mesón de acreditación» — y ahí termina |
| Ya se acreditó | La misma ficha, con la hora en que lo hizo |
| RUT mal escrito | El error en pantalla, sin avanzar |

### Solo se acredita quien está en el padrón

No hay registro en el momento, no hay formulario, no hay excepciones desde la
pantalla. **Quien no esté inscrito se resuelve en el mesón, con una persona** —
que puede marcarlo a mano desde AIEP GESTIÓN si corresponde. El agente tiene
instrucción explícita de no ofrecer ninguna vía alternativa.

---

## Corre en la vitrina, y eso manda sobre cómo guarda

En la vitrina **no hay sesión**: el host público le da a la app un shell
efímero, donde `shell.items` escribe en la memoria de ese navegador y se pierde
al recargar. Así que la acreditación viaja por el **gateway público** del
creator pack (`APP-SPEC` §7.b):

```
POST {api}/api/public/app/{instanceId}/submit/asistencia
```

**No necesita ningún endpoint nuevo en `kimos-enterprice` ni tocar
`setup-kimos`.**

### El único paso: `?aiep=ID` en la URL de la vitrina

El endpoint del gateway se direcciona **por instancia**, así que el totem tiene
que saber cuál es la de AIEP GESTIÓN, y no hay forma de que la descubra solo.
Llega en la URL de la vitrina, **una vez**:

```
https://tu-kimos/vitrina/TOKEN?aiep=ID-DE-LA-INSTANCIA
```

El totem lo guarda en el equipo, así que una recarga sin el parámetro no lo deja
huérfano. AIEP GESTIÓN muestra ese texto listo para copiar hasta que llega la
primera acreditación.

*(El otro paso que había antes —encender la recepción— ya no existe: gestión la
abre sola al abrirse.)*

### Un totem sin conectar NO finge

Si no tiene el identificador, **no deja acreditar**: la portada dice
«Acreditación no disponible — acércate al mesón», y el agente se niega. Mostrar
«✓ Asistencia registrada» a alguien cuyo registro no va a llegar a ninguna parte
es el peor fallo que puede tener esto, así que no se hace nunca.

### Los topes del gateway mandan sobre cómo se envía

`backend/appPublicAPI.py` aplica **8 peticiones por IP+instancia cada 5
minutos**, descarta objetos y listas anidados y recorta cada valor a 5.000
caracteres. Una fila de acreditación se come ese tope en un minuto si se manda
una petición por persona. Así que:

- Se agrupan en **lotes de hasta 12 personas**, que viajan como **un campo de
  texto con JSON dentro** —plano, como exige el saneo— y gestión vuelve a abrir.
- **Una petición por vaciado**, con **40 s de espaciado**: 7 u 8 por ventana, o
  sea ~90 acreditaciones cada 5 minutos. Muy por encima del ritmo real.
- Ante un **429** espera a que se abra la ventana. Ante un **403** (gestión aún
  no acepta envíos) **reintenta**: descartar por eso tiraría a la basura a cada
  persona hasta que alguien se diera cuenta. Solo 400, 413 y 422 —donde el
  envío *es* el problema— se descartan.

**Quien se acredita no espera nada por esto**: su comprobante sale al instante.

### Sin red no se pierde nadie

Lo que no sale se encola en el equipo y se reintenta solo; el pie muestra
cuántos quedan por subir.

---

## El padrón

Sale de la planilla de respuestas del formulario de inscripción del seminario
(«Respuestas 6»), entregada por el organizador: **112 personas**, embebidas en
el bundle para que el totem funcione aunque no haya red.

| | |
|---|---|
| **RUT normalizado** (sin puntos ni guion, K mayúscula) | Es la única forma de comparar lo que la persona marca en el totem con lo que escribió en el formulario, donde aparece de seis maneras distintas. |
| **RUT que la planilla guardó como número** | Perdieron el formato (`17.271.606-7` quedó como `1.72716067E8`). Se reconstruyeron a entero: el dígito verificador es el último dígito y ninguno se perdió. |
| **Tres filas rotas, reparadas** | Dos RUT pegados en una celda; **dos personas en una misma fila** (Felipe Apucino y Tere Meneses, separadas en dos registros); un dígito repetido de más. Las tres reparaciones validan módulo 11. |
| **Dos RUT con dígito verificador mal tipeado y uno vacío** | Se conservan **tal como se escribieron**. Quien llegue con ese RUT igual se acredita. **No se corrigió el RUT de nadie.** |
| **Filas duplicadas** | Misma persona inscrita dos veces: unificadas. |

Reparto por Centro de Negocios: **Ñuñoa 53 · Independencia 32 · San Pablo 20 ·
sin centro 7**.

---

## Aspecto

El chrome —tokens de color, rótulos del afiche, cabecera, barra bajo el header,
cuerpo, tarjetas, botones, pie con el logotipo de Kimos— es **el mismo de
ANFITRIÓN AIEP**, con la clase raíz cambiada. La paleta y su procedencia
(azules del afiche; rojo y azul SERCOTEC muestreados de los logos del `.docx`
del programa) están documentadas en `apps/anfitrion-aiep/dist/index.css`.

---

## El agente es consultivo

**Informa y busca, pero no acredita a nadie**: la acreditación la confirma la
persona con su propio toque en la pantalla.

| Herramienta | Qué hace |
|---|---|
| `CONSULTAR_RUT` | Busca un RUT y deja el resultado **en pantalla**. No acredita. |
| `BUSCAR_POR_NOMBRE` | Busca por nombre o empresa. Devuelve el **RUT enmascarado** (`•••••606-7`): sirve para que la persona se reconozca, no para dictar el RUT de nadie en voz alta. |
| `IR_A_PASO` · `VOLVER_AL_INICIO` | Navegación. |

El snapshot no expone correos ni RUT completos del padrón.

---

## Historial

| Versión | Cambios |
|---|---|
| 3.0.0 | **Vuelve a la vitrina, con un solo paso.** La 2.0.0 guardaba con `shell.items`, que en la vitrina es memoria volátil: el totem mostraba «✓ Asistencia registrada» y el registro no llegaba a ninguna parte. Se vuelve al gateway público, pero ahora **el interruptor de recepción desaparece** (gestión la abre sola) y **un totem sin conectar no finge**: avisa y no deja acreditar. Queda un único paso de puesta en marcha: `?aiep=ID` en la URL de la vitrina. Se mantiene lo bueno de la 2.0.0: sin registro en el totem y sin contadores en la portada. |
| 2.0.0 | Sin configurar nada y sin registro en el totem. Guardaba con `shell.items` — **solo válido en sesión**, no en vitrina. Fuera el gateway público, la cola de envíos por lotes, el campo de instancia de gestión y la pantalla de operador: ahora guarda con `shell.items` y AIEP GESTIÓN encuentra sola todos los totem vía `shell.data`. Fuera también **el registro de quien no está inscrito** (ahora el totem lo dice y ahí termina) y **los contadores de acreditados e inscritos** de la portada. Se conserva el reintento local para que una escritura fallida no pierda a nadie. |
| 1.0.0 | Primera versión: acreditación por RUT contra el padrón, registro en el momento, comprobante, envío por lotes al gateway público con cola local, agente consultivo y el chrome visual de ANFITRIÓN AIEP. |
