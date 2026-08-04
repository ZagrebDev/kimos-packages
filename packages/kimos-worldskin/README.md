# KIMOS WorldSkin

**Dos formas de ver el mismo trabajo, y una organización que se puede recorrer.**

WorldSkin da a una app de KIMOS con flujos de trabajo y agentes:

1. **Forma clásica** — estudio profesional, con modos de luz *Día*, *Atardecer*,
   *Noche* y *Vivo* (sigue la hora del equipo).
2. **Forma juego** — la organización como un mundo jugable, con tres
   ambientaciones: *KimosLab* (villa en píxeles), *JABOTEL* (hotel isométrico) y
   *Spacecraft* (territorio táctico).
3. **Mundo editable** — departamentos, estructuras, puestos y personal. Los
   agentes de IA y las personas conviven como avatares que se mueven en tiempo
   real, y **lo que hacen sale del estado real del flujo**: quien se está
   ejecutando camina a su puesto y trabaja, quien está bloqueado se planta con un
   «!», quien está apagado se va a la zona común.

No es un decorado. Es la misma información del flujo, contada de otra manera.

---

## No es una librería

Las apps de KIMOS son bundles autónomos y **no hay runtime compartido entre
ellas**. WorldSkin es un **paquete de fuentes**: cada app lo incorpora en su
propio build. Nada se carga por red, nada se comparte en memoria, y dos apps que
lo adopten no pueden romperse entre sí.

Todo va prefijado `ws` / `WS_` y no depende de ninguna utilidad del anfitrión,
así que se puede pegar en una app que no comparta una sola línea con la de al
lado.

**Antes de adoptarlo, lee [`docs/CONTRATO.md`](docs/CONTRATO.md).** Define qué
apps son compatibles (resumen: tienen que tener flujo de trabajo y agentes), qué
tiene que poner el anfitrión y qué garantiza el paquete.

---

## Contenido

```
src/17-ws-core.js       Utilidades propias · formas y modos · departamentos · estructuras
src/19-ws-world.js      Modelo del mundo · mutaciones puras · siembra desde el flujo
src/21-ws-sim.js        Simulación de avatares (función pura por paso)
src/53-ws-ui-world.js   Tres proyecciones + superficie animada   ← va dentro de mount()
style/worldskin.css     Decorado de las tres ambientaciones (sin recursos externos)
test/test-worldskin.mjs Pruebas del paquete y de las garantías del contrato
docs/CONTRATO.md        Criterios de compatibilidad, riesgos y verificación
```

Los prefijos numéricos no son decorativos: fijan el orden de concatenación para
que los fragmentos se **intercalen** con los de la app anfitriona.

---

## Modelo en treinta segundos

```
world
├── grid       { w, h }                      hasta 40×40
├── areas[]    departamento o proceso        hasta 60
│   ├── departmentId  rrhh · finanzas · marketing · producción · …
│   ├── structure     sede · oficina · laboratorio · planta · almacén · …
│   ├── x, y, w, h    celdas que ocupa (iguales en las tres ambientaciones)
│   ├── stations[]    los puestos = procesos internos del departamento
│   └── ownerId/Name  ← la PERSONA que responde por el departamento
└── staff[]    personas y agentes de IA      hasta 200
    ├── kind        'ai' | 'human'
    ├── areaId, stationId
    ├── agentId     ← enlaza con un agente del flujo de la app
    ├── userId      ← enlaza con un usuario del anfitrión (KIMOS)
    └── isOwner     ← es el responsable de su departamento
```

**Todo departamento con agentes de IA necesita un responsable humano**, y ese
responsable es un **usuario del anfitrión**, no un nombre escrito a mano: la app
pasa `{ id, name }` de su directorio y el paquete rechaza cualquier cosa sin
identificador. `wsAreasWithoutOwner(world)` devuelve los que están sin cubrir,
para que se vean en la interfaz en vez de quedar en un informe.

La misma área ocupa las mismas celdas en la villa, en el hotel y en el
territorio. Cambiar de ambientación **no mueve nada**: solo cambia la proyección.

---

## Uso mínimo

```js
// Dominio (fuera de mount)
let world = wsSeedWorld(workflowPlan(model), { appId: 'mi-app', groups: [
  { departmentId: 'produccion', name: 'Producción', structure: 'factory' },
  { departmentId: 'marketing',  name: 'Marketing',  structure: 'office'  },
]});

const r = wsAddArea(world, { departmentId: 'rrhh', name: 'Personas', structure: 'training' });
if (r.ok) world = r.world; else notify('error', r.error);

// El responsable sale del directorio del anfitrión, nunca de un campo de texto.
const o = wsSetAreaOwner(world, 'Producción', { id: 'u-ana', name: 'Ana Ruiz' });
if (o.ok) world = o.world;
wsAreasWithoutOwner(world);   // → equipos de IA sin nadie que responda

// UI (dentro de mount)
h(WsWorldSurface, {
  world, kind: 'village',                       // village | hotel | territory
  statusOf: (id) => estadoDelAgente(id),        // running | done | blocked | off | idle
  selArea, selStaff, onSelectArea, onSelectStaff,
});
```

Todas las mutaciones devuelven `{ world, ok, error|message }` y **nunca lanzan**:
un dato imposible se contesta con un mensaje, no con una excepción.

---

## Pruebas

```bash
node packages/kimos-worldskin/test/test-worldskin.mjs
```

Cubre el modelo, las mutaciones, la siembra desde el flujo, el determinismo de
la simulación y las garantías del contrato (sin red, sin recursos externos, sin
estado global, cotas duras, CSS enclaustrado).

---

## Apps que lo adoptan

| App | Versión de WorldSkin | Notas |
|---|---|---|
| `apps/kreative-studio` | 1.0.0 | Intercala los fragmentos desde el build (`build.mjs`) |

Si adoptas WorldSkin, añádete a esta tabla. Sirve para saber a quién hay que
avisar cuando cambie algo mayor.
