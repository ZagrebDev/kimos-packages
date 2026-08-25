# LiDARia 🛰️

Consola de captura 3D de KIMOS. Responde, con datos y no con folletos, qué puede
escanear cada equipo de la organización, qué módulos quedan cubiertos con el
parque que ya existe, cuánto cuesta construir cada módulo y qué bibliotecas
pueden entrar al producto sin problema legal.

**Versión actual: 1.1.0** · núcleo `kimos-LiDARia` 1.1.0

## Por qué existe

Una app de escaneo que se abre en un teléfono sin sensor y falla en silencio
pierde al usuario en el primer minuto. LiDARia parte por lo contrario: **decir
la verdad sobre el equipo antes de prometer nada**. Este bundle corre en el
escritorio de KIMOS —donde justamente no hay LiDAR— y por eso no intenta
capturar: decide.

| Pestaña | Qué responde |
|---|---|
| **Panel** | Qué es LiDARia, qué puede este equipo (diagnóstico en vivo del navegador donde corre el shell) y el enlace para abrir la app de captura en el teléfono correcto. |
| **Rubros** | La misma app en el lenguaje de cada industria: 12 rubros con su tolerancia, sus módulos en orden, su flujo, sus KPI y su normativa, ordenados por lo cerca que está la organización de poder ejecutarlos. **Ampliable con packs `.krub`** sin tocar el producto. |
| **Módulos** | Los 11 módulos con su estado real según el inventario: qué necesita cada uno, qué entrega, con qué módulo de KIMOS se conecta, cuánto cuesta y cuáles son sus riesgos declarados. |
| **Inventario** | El parque real de la organización. Registra equipos y calcula cobertura: qué módulos quedan completos, cuáles no y **qué equipo conviene sumar** para cubrir los que faltan. |
| **Equipos** | Matriz de 18 familias de equipos contra los 11 módulos, con el sensor de cada uno y el error esperable a 3 m. Exportable a CSV. |
| **Prospección** | Prepara la visita: califica al prospecto por su rubro, su parque de equipos y las apps de KIMOS que ya usa; dice qué se le puede vender hoy y qué exige comprar equipo; arma el argumento cuantificado, el guion de la reunión y el registro que queda en la oportunidad del CRM. |
| **Ecosistema** | Con qué apps de KIMOS se conecta de verdad: qué dato viaja, por qué contrato, si se puede hoy y si vale la pena. Incluye las marginales y las descartadas, con el motivo. |
| **Negocio** | La calculadora: supuestos editables (cartera, usuarios, costo de desarrollo, costo de operar, churn) y recálculo en vivo de ingreso, margen, inversión, payback y retorno por módulo y por fase. |
| **Plan** | Las cuatro fases con su esfuerzo, su inversión, su payback y el riesgo principal de cada módulo. |
| **Licencias** | Qué puede entrar al producto: política de licencias, reglas de cadena de suministro, 28 bibliotecas del dominio 3D evaluadas una a una y las fuentes de datos con su licencia. |

## Lo que la app nunca hace

- **No afirma que un iPhone tiene LiDAR desde el navegador.** Safari no expone el
  modelo: el diagnóstico lo dice y pide confirmar.
- **No cuenta como disponible un sensor que el entorno no deja usar.** El LiDAR
  de un iPhone en Safari aparece como *al alcance* (con la app nativa), no como
  activo. Prometer captura que luego no ocurre es el peor error posible.
- **No presenta los números de negocio como hechos.** Son supuestos declarados y
  editables; lo que vale es el orden que producen, no la cifra.
- **No dice que "cumple" cuando cumple justo.** Si el error esperado del sensor
  cabe exactamente en la tolerancia del rubro, lo dice con esas palabras: en
  terreno, sin margen, eso falla.
- **No promete integraciones de relleno.** Cinco de las 26 apps evaluadas están
  marcadas como marginales o descartadas, con el motivo escrito.

## Cómo se construye

```bash
node apps/lidaria/build.mjs        # arma dist/index.js
node apps/lidaria/test/smoke.mjs   # monta la app y ejercita el agente sin navegador
node tools/check-versions.mjs lidaria
```

`src/nucleo.mjs` y `src/payload.json` son **copias generadas** desde el
repositorio [`kimos-LiDARia`](https://github.com/bvaldes-arch/kimos-LiDARia)
(`node tools/build-kimos-payload.mjs`). No se editan aquí: se regeneran allá y
se copian. `nucleo.mjs` sirve para dos cosas: `build.mjs` lo incrusta en el
bundle (quitando su bloque de exportación) y `tools/pack-rubro.mjs` lo importa
para validar packs de rubro con el mismo código que corre en la app. Ese repositorio es la fuente de verdad del motor, del catálogo de
equipos, del catálogo de módulos y de la política de licencias, y es donde vive
además la PWA de captura.

## Packs de rubro

La pestaña **Rubros** carga packs `.krub` (o el `pack.json` suelto). Se
empaquetan con `node tools/pack-rubro.mjs` desde este mismo repositorio o desde
el **Creator Pack 2.0** —ver [`CREA-TU-RUBRO.md`](../../CREA-TU-RUBRO.md)—, y un
ejemplo completo vive en [`packs/`](packs/): añade un rubro nuevo y extiende uno
del producto sin copiarlo.

Un pack **solo puede añadir o extender**: nunca borra lo que trae el producto,
cada rubro queda marcado con su origen, y al restaurar la sesión se revalida
—un pack guardado contra un catálogo que cambió se descarta en vez de entrar en
silencio—.

## Agente IA

La app registra nueve herramientas: `VER_PESTANA`, `AGREGAR_EQUIPO`,
`QUITAR_EQUIPO`, `SET_SUPUESTO`, `RECOMENDAR_EQUIPO`, `SET_RUBRO`,
`FICHA_PROSPECTO`, `VER_INTEGRACION` y `EVALUAR_LICENCIA`.
`getSnapshot()` entrega el inventario, la cobertura por módulo, el catálogo de
equipos, los rubros con su viabilidad y su margen de tolerancia, los packs
cargados, el registro del prospecto en curso, las anclas y descartes del
ecosistema, el resumen económico por fase y la lista de bibliotecas vetadas. Así
el agente puede responder *"¿con lo que tenemos podemos levantar planos?"*,
*"¿qué le ofrezco a una constructora que solo tiene Android?"* o *"¿puedo usar
OpenMVS?"* sin inventar.

## Historial

| Versión | Qué trae |
|---|---|
| 1.1.0 | Base de conocimiento por rubro (12 rubros, packs `.krub` ampliables con validación y revalidación al restaurar), pestaña de prospección (calificación por parque de equipos, propuesta cuantificada, guion de visita y registro para el CRM), mapa de vinculación con las 26 apps del ecosistema en tres tramos, y tres herramientas nuevas de agente. El veredicto de tolerancia pasa a tres grados: cumple con margen, cumple justo, no alcanza. |
| 1.0.0 | Primera versión: diagnóstico del equipo, catálogo de 11 módulos, inventario con cobertura y recomendación de compra, matriz de 18 equipos, calculadora de negocio con supuestos editables, plan por fases, política de licencias con 28 bibliotecas evaluadas y agente con seis herramientas. |
