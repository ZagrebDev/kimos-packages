# LiDARia 🛰️

Consola de captura 3D de KIMOS. Responde, con datos y no con folletos, qué puede
escanear cada equipo de la organización, qué módulos quedan cubiertos con el
parque que ya existe, cuánto cuesta construir cada módulo y qué bibliotecas
pueden entrar al producto sin problema legal.

**Versión actual: 1.0.0** · núcleo `kimos-LiDARia` 1.0.0

## Por qué existe

Una app de escaneo que se abre en un teléfono sin sensor y falla en silencio
pierde al usuario en el primer minuto. LiDARia parte por lo contrario: **decir
la verdad sobre el equipo antes de prometer nada**. Este bundle corre en el
escritorio de KIMOS —donde justamente no hay LiDAR— y por eso no intenta
capturar: decide.

| Pestaña | Qué responde |
|---|---|
| **Panel** | Qué es LiDARia, qué puede este equipo (diagnóstico en vivo del navegador donde corre el shell) y el enlace para abrir la app de captura en el teléfono correcto. |
| **Módulos** | Los 11 módulos con su estado real según el inventario: qué necesita cada uno, qué entrega, con qué módulo de KIMOS se conecta, cuánto cuesta y cuáles son sus riesgos declarados. |
| **Inventario** | El parque real de la organización. Registra equipos y calcula cobertura: qué módulos quedan completos, cuáles no y **qué equipo conviene sumar** para cubrir los que faltan. |
| **Equipos** | Matriz de 18 familias de equipos contra los 11 módulos, con el sensor de cada uno y el error esperable a 3 m. Exportable a CSV. |
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

## Cómo se construye

```bash
node apps/lidaria/build.mjs        # arma dist/index.js
node apps/lidaria/test/smoke.mjs   # monta la app y ejercita el agente sin navegador
node tools/check-versions.mjs lidaria
```

`src/nucleo.js` y `src/payload.json` son **copias generadas** desde el
repositorio [`kimos-LiDARia`](https://github.com/bvaldes-arch/kimos-LiDARia)
(`node tools/build-kimos-payload.mjs`). No se editan aquí: se regeneran allá y
se copian. Ese repositorio es la fuente de verdad del motor, del catálogo de
equipos, del catálogo de módulos y de la política de licencias, y es donde vive
además la PWA de captura.

## Agente IA

La app registra seis herramientas: `VER_PESTANA`, `AGREGAR_EQUIPO`,
`QUITAR_EQUIPO`, `SET_SUPUESTO`, `RECOMENDAR_EQUIPO` y `EVALUAR_LICENCIA`.
`getSnapshot()` entrega el inventario, la cobertura por módulo, el catálogo de
equipos, el resumen económico por fase y la lista de bibliotecas vetadas, así
que el agente puede responder cosas como *"¿con lo que tenemos podemos levantar
planos?"* o *"¿puedo usar OpenMVS?"* sin inventar.

## Historial

| Versión | Qué trae |
|---|---|
| 1.0.0 | Primera versión: diagnóstico del equipo, catálogo de 11 módulos, inventario con cobertura y recomendación de compra, matriz de 18 equipos, calculadora de negocio con supuestos editables, plan por fases, política de licencias con 28 bibliotecas evaluadas y agente con seis herramientas. |
