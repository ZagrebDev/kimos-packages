# AIEP INSCRIPCIÓN

Totem de **acreditación por RUT** del Seminario **«IA y Protección de Datos: Lo
que Todo Negocio Debe Saber para No Quedarse Atrás»**, en la Sede AIEP San
Joaquín, organizado con los Centros de Negocios SERCOTEC de Ñuñoa, San Pablo e
Independencia.

**Versión actual: 1.0.0**

---

## Qué hace

El asistente llega, toca **Acreditarme**, marca su RUT en el teclado de la
pantalla y queda registrado como que asistió.

| Caso | Qué ve | Qué se guarda |
|---|---|---|
| Viene del formulario de inscripción | Su nombre, empresa y Centro de Negocios, para que confirme | `origen: "padron"` |
| Llega sin inscripción previa | Un formulario corto (nombre obligatorio, empresa y correo opcionales) | `origen: "presencial"` |
| Ya se acreditó antes | Un aviso con la hora en que lo hizo, y puede confirmar igual | Ambas marcas |
| RUT mal escrito | El error en pantalla, sin avanzar | Nada |

La gestión de esas asistencias —quién llegó, buscar, filtrar por Centro de
Negocios, exportar— vive en la app **AIEP GESTIÓN**.

---

## Dónde se guarda la asistencia (y por qué así)

Este totem se monta en la **Vitrina** pública. Ahí el host (`PublicAppHost`) le
da a la app un shell **efímero**: `saveData` e `items` viven solo en la memoria
del navegador del visitante y **no llegan a los datos del equipo**. Guardar la
acreditación con `shell.items` sería guardarla en ninguna parte.

Por eso la asistencia viaja por el **gateway público** del creator pack
(`APP-SPEC` §7.b):

```
POST {api}/api/public/app/{instanceId}/submit/asistencia
```

donde `{instanceId}` es la instancia de **AIEP GESTIÓN** que hizo opt-in
(`definition.public.enabled`) y declaró el canal `asistencia`. Es el camino
documentado del creator pack: **no necesita un endpoint nuevo en
`kimos-enterprice` ni tocar `setup-kimos`**.

### Los topes del gateway mandan sobre cómo se envía

`backend/appPublicAPI.py` aplica **8 peticiones por IP+instancia cada 5
minutos**, descarta objetos y listas anidados, y recorta cada valor a 5.000
caracteres. Un totem en la fila de acreditación se come ese tope en un minuto
si manda una petición por persona. Así que:

- Las acreditaciones se agrupan en **lotes de hasta 12 personas**, que viajan
  como **un campo de texto con JSON dentro** (`lote`) —plano, como exige el
  saneo— y AIEP GESTIÓN vuelve a abrir al leerlo.
- Sale **una petición por vaciado**, con **40 s de espaciado mínimo**: 7 u 8
  peticiones por ventana de 5 minutos, o sea **~90 acreditaciones cada 5
  minutos**. Muy por encima del ritmo real de una acreditación presencial.
- Ante un **429** el totem espera a que se abra la ventana en vez de gastar
  reintentos contra la pared. Ante un 4xx de contrato (instancia sin opt-in,
  canal no declarado) avisa al operador en vez de reintentar para siempre.

**Quien se acredita no espera nada por esto**: su comprobante sale al instante
desde el propio totem. El pie muestra cuántos registros quedan por subir.

### Sin red no se pierde nadie

El recinto puede quedarse sin conexión un rato, y una acreditación perdida es
una persona que se queda fuera de la lista. Cada envío que falla se **encola en
`localStorage`** y se reintenta solo.

El invariante que se verificó es: **acreditados = recibidos por el servidor +
pendientes en la cola**, en los cuatro escenarios (red normal, red caída, tope
429, y red que vuelve). Nunca se pierde a nadie.

---

## El padrón

Sale de la planilla de respuestas del formulario de inscripción del seminario
(«Respuestas 6»), entregada por el organizador: **112 personas**, embebidas en
el bundle para que el totem funcione aunque no haya red.

Qué se hizo con esos datos, y por qué:

| | |
|---|---|
| **RUT normalizado** (sin puntos ni guion, K mayúscula) | Es la única forma de comparar lo que la persona marca en el totem con lo que escribió en el formulario, donde aparece de seis maneras distintas. |
| **RUT que la planilla guardó como número** | Perdieron el formato (`17.271.606-7` quedó como `1.72716067E8`). Se reconstruyeron a entero: el dígito verificador es el último dígito y ninguno se perdió. |
| **Tres filas rotas, reparadas** | Dos RUT pegados en una celda; **dos personas en una misma fila** (Felipe Apucino y Tere Meneses, separadas en dos registros); un dígito repetido de más. Las tres reparaciones validan módulo 11. |
| **Dos RUT con dígito verificador mal tipeado y uno vacío** | Se conservan **tal como se escribieron**. Quien llegue con ese RUT igual se acredita, y gestión ve el caso. **No se corrigió el RUT de nadie.** |
| **Filas duplicadas** | Misma persona inscrita dos veces: unificadas. |

Reparto por Centro de Negocios: **Ñuñoa 53 · Independencia 32 · San Pablo 20 ·
sin centro 7**.

Nada se inventó y nada se descartó en silencio: las tres reparaciones y los
tres RUT dudosos están documentados arriba y en el comentario del `PADRON` en
`dist/index.js`.

---

## Aspecto

El chrome —tokens de color, rótulos del afiche, cabecera, barra bajo el header,
cuerpo, tarjetas, botones, pie con el logotipo de Kimos y resalte del agente—
es **el mismo de ANFITRIÓN AIEP**, con la clase raíz cambiada. Los totem del
seminario tienen que leerse como un solo sistema, no como tres apps que se
parecen. La paleta y su procedencia (azules del afiche; rojo y azul SERCOTEC
muestreados de los logos del `.docx` del programa) están documentadas en
`apps/anfitrion-aiep/dist/index.css`.

Igual que el anfitrión, el cuerpo reserva abajo la franja del **widget de chat
de la vitrina** (`--ai-dock-safe`, 340 px en modo totem) para que ningún botón
quede bajo el micrófono.

---

## El agente es consultivo

El agente incrustado en la vitrina **informa y busca, pero no acredita a
nadie**: la acreditación la confirma la persona con su propio toque en la
pantalla. Nadie queda registrado por una conversación.

| Herramienta | Qué hace |
|---|---|
| `CONSULTAR_RUT` | Busca un RUT y deja el resultado **en pantalla**: la ficha si viene inscrita, el formulario de registro si no. No acredita. |
| `BUSCAR_POR_NOMBRE` | Busca por nombre o empresa. Devuelve el **RUT enmascarado** (`•••••606-7`): sirve para que la persona se reconozca, no para dictar el RUT de nadie en voz alta. |
| `IR_A_PASO` | Mueve el totem por el flujo. |
| `ESTADO_SALA` | Cuántos lleva acreditados el totem y cuántos envíos quedan por subir. |
| `VOLVER_AL_INICIO` | Portada, y borra lo escrito a medias. |

El snapshot no expone correos ni RUT completos del padrón: solo los totales y
el reparto por Centro de Negocios.

---

## Puesta en marcha

1. Instalar **AIEP GESTIÓN** y crear su documento del seminario.
2. En AIEP GESTIÓN → **Publicación**, activar la recepción y copiar el
   identificador de la instancia.
3. Instalar esta app y pegar ese identificador en **⚙️ Configurar → Instancia
   de AIEP GESTIÓN**. En la vitrina también sirve añadir `?aiep=ID` a la URL,
   o dejarlo guardado en el equipo desde la pantalla de operador.
4. La **pantalla de operador** (emparejamiento, contadores, reintento manual)
   se abre manteniendo pulsado el logo AIEP de la cabecera **tres segundos**:
   en un totem público no puede ser un botón a la vista.

---

## Historial

| Versión | Cambios |
|---|---|
| 1.0.0 | Primera versión: acreditación por RUT contra el padrón de 112 inscritos, registro en el momento para quien llega sin inscripción, comprobante en pantalla, envío por lotes al gateway público con cola local a prueba de cortes de red, agente consultivo y el chrome visual de ANFITRIÓN AIEP. |
