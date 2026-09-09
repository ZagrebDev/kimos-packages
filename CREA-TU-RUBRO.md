# Crea tu pack de rubro para LiDARia

Guía **pública** para ampliar la base de conocimiento de **LiDARia** —la app de
captura 3D de KIMOS— con tu propia industria, sin tocar el producto y sin
escribir una línea de código.

> ¿Buscas cómo crear una **app** de KIMOS? Eso es `CREA-TU-APP.md`. Aquí se crea
> **conocimiento** para una app que ya existe.

---

## 1. Qué es un pack de rubro

LiDARia sabe qué puede hacer cada equipo (LiDAR, ToF, profundidad por
movimiento) y con qué margen de error. Un **pack de rubro** traduce eso al
lenguaje de una industria concreta:

| Lo que declara el pack | Para qué sirve |
|---|---|
| **Tolerancia** (`m` a una `aDistancia`) | La app cruza esa exigencia con el sensor real del equipo y responde: *cumple con margen*, *cumple justo* o *no alcanza*. Es lo que evita prometer una precisión que el teléfono del cliente no da. |
| **Módulos en orden de prioridad** | Por cuál se entra al rubro y qué se suma después. |
| **Flujos** | Cómo se trabaja, paso a paso, y qué se entrega al final. |
| **KPI** | Qué mejora medible justifica el gasto. |
| **Normativa** | Lo que no se puede prometer sin certificación o consentimiento. |
| **Material de prospección** | Señales de calificación, preguntas de descubrimiento, la demostración que se hace en la visita, y las objeciones con su respuesta. |

Un pack se distribuye como archivo **`.krub`** (un ZIP con `pack.json` dentro),
igual que una app se distribuye como `.kapp`.

**Un pack solo puede añadir o extender.** Nunca borra ni reemplaza lo que trae
el producto, y cada rubro queda marcado con su origen, visible en pantalla.

---

## 2. Quickstart — tu primer pack en 15 minutos

### 2.1 La cabecera

Mismas convenciones que un `manifest.json` de app: id con **namespace**,
versión **semver**, autor y contrato declarado.

```jsonc
{
  "id": "miorg.mi-rubro",          // namespace obligatorio en la práctica
  "nombre": "Pack de rubro: lo mío",
  "version": "1.0.0",
  "autor": "Mi Organización",
  "rubroPackApi": "1.x",           // como appShellApi: se valida el MAYOR
  "descripcion": "Qué añade este pack, en una frase.",
  "rubros": [ /* … */ ]
}
```

### 2.2 Un rubro

```jsonc
{
  "id": "miorg.talleres",
  "nombre": "Talleres mecánicos",
  "icon": "🔩",
  "cliente": "Talleres con más de dos elevadores y bodega de repuestos.",
  "dolor": "El repuesto se pide por catálogo y llega equivocado porque nadie midió la pieza.",

  "tolerancia": { "m": 0.01, "aDistancia": 0.5 },
  "toleranciaNota": "Para identificar la pieza alcanza; para fabricarla, no.",

  "modulos": [
    { "id": "objetos", "prioridad": 1, "para": "Fichar la pieza real con su medida." },
    { "id": "medir",   "prioridad": 2, "para": "Cotas sueltas en el elevador." }
  ],

  "flujos": [{
    "id": "ficha-pieza",
    "nombre": "De la pieza al pedido",
    "pasos": ["Escanear la pieza", "Revisar la medida", "Adjuntar al pedido"],
    "entrega": ["Modelo 3D", "Medidas", "Ficha para el proveedor"],
    "kimos": ["pedidos", "productos"]
  }],

  "kpis": [
    { "id": "errores", "label": "Repuestos devueltos por medida", "meta": "Bajar a la mitad" }
  ],

  "equiposRecomendados": ["apple.iphone.pro.12-17"],
  "normativa": [],

  "prospeccion": {
    "senales": ["Devoluciones frecuentes de repuestos"],
    "preguntas": ["¿Cuántos repuestos devuelven al mes por medida equivocada?"],
    "demo": "Escanear una pieza del propio taller y mostrar sus medidas en la reunión.",
    "objeciones": [
      { "objecion": "Ya tenemos pie de metro.", "respuesta": "Y sigue sirviendo. Lo que falta es que la medida quede en el pedido, no en la memoria de alguien." }
    ],
    "ahorro": { "supuesto": "Devoluciones evitadas × costo de la devolución", "formula": "devoluciones * costoDevolucion" }
  },

  "kimos": ["pedidos", "productos", "clientes"]
}
```

Los ids de `modulos`, `equiposRecomendados` y `kimos` tienen que existir en
LiDARia: el validador los comprueba y rechaza el pack si inventas uno.

### 2.3 Extender un rubro que ya existe

Para añadir tu flujo a un rubro del producto (sin copiarlo entero):

```jsonc
{ "id": "construccion", "extiende": true,
  "flujos": [ { "id": "mi-flujo", "nombre": "…", "pasos": ["…"], "entrega": ["…"] } ],
  "normativa": ["Lo que en mi región hay que respetar."] }
```

Las listas se fusionan por `id`; los textos que envíes reemplazan a los del
producto. Sin `extiende`, un id repetido es un error (para que nadie pise un
rubro por accidente).

### 2.4 Empaquetar e instalar

```bash
node tools/pack-rubro.mjs mi-rubro.json      # → miorg.mi-rubro-1.0.0.krub
```

En KIMOS: **LiDARia → Rubros → Ampliar la base de conocimiento** → elegir el
archivo. La app valida otra vez al cargarlo (mismo validador que el
empaquetador, así que lo que pasa aquí pasa allá) y lo guarda con la instancia.

---

## 3. Cómo se decide una tolerancia

Es el campo que más se equivoca, y el que más daño hace mal puesto. Regla:
**la tolerancia es lo que el trabajo exige, no lo que el equipo entrega.**

Referencia de lo que dan los sensores (banda de ingeniería, no calibración):

| Sensor | A 0,5 m | A 3 m |
|---|---|---|
| LiDAR (dToF) | ±0,5 cm | ±3 cm |
| ToF continuo | ±1 cm | ±7,5 cm |
| Luz estructurada (frontal) | ±0,25 cm | fuera de rango |
| Profundidad por movimiento | ±3 cm | ±21 cm |

Si tu rubro exige ±0,5 cm a 3 m, ningún equipo de bolsillo lo cumple, y lo
correcto es declararlo así: la app lo dirá en pantalla en vez de que alguien lo
descubra en terreno.

---

## 4. Reglas y buenas prácticas

- **Namespace en el id** (`miorg.…`): sin él, tu pack puede chocar con otro.
- **Nada de promesas sin fuente.** Los KPI son metas, no resultados medidos.
- **Normativa antes que entusiasmo.** Si en tu rubro medir para facturar exige
  certificación metrológica, ponlo: la app lo muestra donde corresponde.
- **La demostración importa más que la presentación.** El campo `demo` es lo que
  se hace en la reunión, no lo que se cuenta.
- **Versiona.** Sube `version` en cada cambio: es como se sabe qué pack está
  cargado.

---

## 5. Qué comprueba el validador

`node tools/pack-rubro.mjs` falla —antes de generar nada— si:

- El `rubroPackApi` tiene otro número **mayor**.
- Falta `id`, `version`, o el id no cumple el formato.
- Un rubro nuevo no trae `nombre`, `cliente`, `dolor`, `tolerancia` o `modulos`.
- La tolerancia no tiene `m` y `aDistancia` mayores que cero.
- Un módulo o un equipo referido **no existe** en LiDARia.
- El pack pisa un rubro existente sin declarar `extiende`.

Y avisa (sin bloquear) si el rubro no trae flujos, KPI o material de
prospección: se puede cargar igual, pero rinde la mitad.

---

## 6. De dónde sale todo esto

El motor que valida y aplica los packs vive en el repositorio
**kimos-LiDARia** (`src/core/rubros.js`), y es el mismo que corre dentro de la
app. Este pack de creadores incluye una copia del núcleo (`tools/lidaria-nucleo.mjs`)
solo para que el empaquetador pueda validar sin acceso al repositorio.
