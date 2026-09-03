# AIEP INSCRIPCIÓN

Totem de **acreditación por RUT** del Seminario **«IA y Protección de Datos: Lo
que Todo Negocio Debe Saber para No Quedarse Atrás»**, en la Sede AIEP San
Joaquín, organizado con los Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e
Independencia.

**Versión actual: 2.0.0**

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

## No hay nada que configurar

El totem guarda cada acreditación en los items de su propia instancia, con
`shell.items.create()`. **AIEP GESTIÓN las encuentra sola**: declara
`data.read:aiep.inscripcion` en su manifest y con eso ve todas las instancias
del totem a las que el usuario ya tiene acceso. Si hay tres totem en la puerta,
los tres se suman sin emparejar nada, sin identificadores que pegar y sin
interruptores que activar.

Se instala, se abre y funciona.

### Dónde corre

**En sesión, como app instalada** en el equipo de la puerta. No en la vitrina
anónima: ahí el host público da un shell efímero —lo que se guarda vive solo en
la memoria de ese navegador y no llega a los datos del equipo—, así que una
acreditación hecha en la vitrina no existiría para nadie más. El totem de
acreditación es equipo del staff, y a cambio de estar en sesión no hay nada que
configurar.

*(ANFITRIÓN AIEP sí es de vitrina: solo informa, no guarda nada.)*

### Sin poder escribir no se pierde nadie

Una acreditación perdida es una persona que se queda fuera de la lista. Si la
escritura falla, la acreditación se guarda en el equipo y se reintenta sola cada
8 segundos; el pie muestra cuántas quedan por guardar. Verificado: con la
escritura caída nadie desaparece, y al volver se guardan todas.

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
| 2.0.0 | **Sin configurar nada y sin registro en el totem.** Fuera el gateway público, la cola de envíos por lotes, el campo de instancia de gestión y la pantalla de operador: ahora guarda con `shell.items` y AIEP GESTIÓN encuentra sola todos los totem vía `shell.data`. Fuera también **el registro de quien no está inscrito** (ahora el totem lo dice y ahí termina) y **los contadores de acreditados e inscritos** de la portada. Se conserva el reintento local para que una escritura fallida no pierda a nadie. |
| 1.0.0 | Primera versión: acreditación por RUT contra el padrón, registro en el momento, comprobante, envío por lotes al gateway público con cola local, agente consultivo y el chrome visual de ANFITRIÓN AIEP. |
