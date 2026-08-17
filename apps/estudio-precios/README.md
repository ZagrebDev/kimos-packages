# 📊 Estudio de Precios KIMOS

**Versión actual: 1.0.0** — la app la muestra en su cabecera (`v1.0.0`, junto al
título), así se sabe de un vistazo qué build quedó instalado al probar. El
número vive en **cuatro** lugares que deben ir siempre juntos:

1. `manifest.json` de la app (`version`);
2. la constante `APP_VERSION` de `dist/index.js` (la que pinta el chip);
3. el **catálogo raíz del repo** (`/manifest.json` → `apps[] → estudio-precios`),
   que es lo que lee la Tienda de KIMOS: **si este no sube, no aparece la
   actualización** aunque el resto esté al día;
4. esta línea del README y la tabla de versiones del final.

Dashboard interactivo del estudio de mercado de agosto de 2026: las 24
aplicaciones de KIMOS contra 154 planes de la competencia, y el modelo de
suscripción que sale de ahí. Multi-instancia: cada documento es un escenario de
precios distinto (uno "oficial", uno para una negociación concreta, uno para
probar un factor agresivo) y cada uno guarda sus propias ediciones.

## El modelo, en tres líneas

```
mediana(planes PyME de la categoría) × factor de posicionamiento = precio sugerido del módulo
Σ módulos del plan × (1 − descuento de bundle)                   = precio del plan
precio del plan ÷ gasto actual del cliente                       = el número que decide la venta
```

Nada está congelado en el archivo: los 24 precios sugeridos, los 4 planes, los
5 kits y los gráficos se recalculan en cada tecla desde las 154 filas de
competencia.

Dos decisiones metodológicas que conviene conocer antes de discutir una cifra:

- **La mediana excluye los planes Enterprise** (Akeneo, Salsify, Cvent, Bizzabo,
  Kissflow, Nintex). Son de otro segmento y distorsionaban la referencia: con
  ellos dentro, *Gestión de Eventos* sugería USD 1.162/mes. Se siguen mostrando
  en la tabla y en el rango máximo, pero fuera del cálculo. En la tabla se
  marcan con la píldora `Enterprise`, y basta un clic para incluir o excluir
  cualquier fila.
- **140 de los 154 precios están verificados** contra la tarifa publicada del
  proveedor. Los 14 restantes son proveedores que no publican precio (Agicap,
  Cvent, Salsify, Bizzabo) o sitios que no respondieron: van marcados
  `Estimado` y **no** se ocultan, porque una mediana mal calculada arrastra el
  error a todo el modelo aguas abajo. Hay que cerrarlos antes de publicar
  tarifas.

## Las siete pestañas

| Pestaña | Qué resuelve |
|---|---|
| **Resumen** | Los KPI que importan (gasto actual del cliente, precio KIMOS, % del gasto, ahorro anual, cobertura de datos), el gráfico de sugerido vs. mediana módulo a módulo, el reparto del gasto que KIMOS reemplaza y la escalera de planes. Más el estudio resumido en seis frases. |
| **Mapa competitivo** | Cada app contra quién compite, el rango del mercado (mín · mediana · máx), el precio sugerido —**editable**, y al fijarlo el módulo deja de seguir el modelo— y la cobertura de datos de esa categoría. |
| **Precios por app** | Los cuatro supuestos (usuarios, canales, factor de posicionamiento, descuento anual) y la tabla completa de la competencia: precio, unidad de cobro, segmento, confianza y notas, todo editable, más agregar y eliminar filas. |
| **Planes y kits** | Los 4 planes y los 5 kits con su descuento de bundle y su composición de módulos editables, y el chequeo de realidad: qué gasta hoy el cliente tipo armando el stack por su cuenta. |
| **Configurador** | Se marcan los módulos que el cliente necesita y sale la cotización en vivo, comparada contra lo que costaría comprar cada herramienta por separado, con aviso si se sale de la banda sana 25%–60%. |
| **Pros y contras** | Una tarjeta por módulo con lo que KIMOS tiene a favor y en contra frente a la competencia real de esa categoría. Los tres textos (a favor, en contra, estrategia) son editables. |
| **Diagnóstico** | Ocho puntajes de posición competitiva (editables: son un juicio, no un dato), la concentración del valor por módulo, ocho sugerencias accionables, la conclusión sobre desarrollo/implementación/escalabilidad y un bloc de notas que se guarda con el estudio. |

## Qué es editable (y se guarda)

Todo lo que cambia una decisión de precio: los cuatro supuestos, el precio de
cada fila de la competencia, su unidad de cobro, su segmento y su confianza,
filas nuevas y filas eliminadas, el precio sugerido de cada módulo (override
manual, se vacía el campo para volver al cálculo), el descuento y la
composición de cada plan y kit, la selección y el descuento del configurador,
los textos de pros/contras/estrategia, los ocho puntajes y las notas.

Se persiste con `saveData/loadData` (debounce de 700 ms) y también responde a
🗂️ Documentos: `onSerialize`/`onLoad` permiten guardar versiones del escenario
y restaurarlas. `↺ Restablecer` (con confirmación) devuelve los datos originales
del estudio.

**Exportar**: `↓ CSV` baja el detalle de competencia y el resumen por módulo
(con BOM, para que Excel en Windows respete los acentos); `↓ JSON` baja el
modelo completo —supuestos, módulos, planes, kits, stack, filas y notas— para
seguir trabajándolo fuera.

## Agente IA

| Acción | Para qué |
|---|---|
| `IR_A_PESTANA` | Cambia la pestaña visible. |
| `SET_SUPUESTO` | Usuarios, canales, factor de posicionamiento o descuento anual. |
| `SET_PRECIO_COMPETIDOR` | Corrige el precio, la confianza, las notas o la fuente de una fila (por `id`, o por competidor + plan; si hay ambigüedad devuelve los ids candidatos en vez de adivinar). |
| `ADD_COMPETIDOR` / `REMOVE_COMPETIDOR` | Agrega o elimina alternativas de la competencia. |
| `SET_PRECIO_MODULO` | Fija a mano el precio de un módulo, u omite el precio para devolverlo al cálculo. |
| `SET_DESCUENTO_BUNDLE` / `SET_MODULOS_PLAN` | Ajusta el descuento o la composición de un plan o kit. |
| `COTIZAR` | Cotiza un conjunto de módulos o un preset y responde con precio, equivalente de mercado y veredicto de la banda 25%–60%. |
| `SET_TEXTO_APP` | Reescribe los pros, las contras o la estrategia de un módulo. |
| `SET_PUNTAJE` / `SET_NOTAS` | Ajusta el diagnóstico. |
| `RESTABLECER` | Vuelve a los datos originales del estudio. |

`getSnapshot()` entrega la versión del build, los supuestos, el estado del
mercado (filas, verificadas, gasto del cliente tipo), los 24 módulos con su
mediana y su sugerido, los 9 planes/kits con su precio y su equivalente de
mercado, la cotización activa y las 154 filas **con su `id`**, para que el
agente sepa sobre qué actuar antes de despachar.

## Notas técnicas

- **Sin librerías externas ni red en runtime.** Los gráficos (barras, columnas y
  anillo) son HTML y SVG propios que toman sus colores de las variables CSS, no
  de constantes en JS: siguen al tema del host sin código de sincronización. El
  dashboard HTML original cargaba Chart.js desde un CDN y se quedaba sin
  gráficos al abrirlo sin internet.
- **Colores.** Superficies, texto y bordes salen de los tokens del tema
  (APP-SPEC §9), así el modo día/noche sale gratis. La paleta de datos
  —violeta, calipso, fucsia, verde agua, naranja— sí es propia: es el código de
  color con el que se leen los gráficos, y está declarada dos veces (saturada
  para fondo claro, abierta para fondo oscuro) para que signifique lo mismo en
  ambos modos. El acento se puede cambiar desde ⚙️ Configurar.
- **Entrada validada.** Todo lo que entra —usuario o agente— pasa por
  `filaLimpia`/`normalizar`: se recortan rangos, se validan unidades y nombres
  de app, y los textos tienen tope de largo. Un documento guardado con datos
  corruptos no rompe la app: se cae a los valores del estudio.
- **Módulos sin competencia relevada.** Si se borran todas las filas de una
  categoría, su mediana y su sugerido quedan en 0 en vez de romper el cálculo; y
  si a una categoría solo le quedan planes Enterprise, la tabla lo avisa
  (*"mediana sesgada"*) en lugar de calcular en silencio sobre una base que no
  corresponde.
- **Módulos de plataforma.** Apariencia, Configuración, Seguridad y Usuarios no
  aparecen en el estudio: son parte del core de la plataforma, no SKUs
  vendibles. Van declarados en el dataset (`core_plat`) para dejar constancia de
  que fue una decisión y no un olvido.

## Origen de los datos

El dataset embebido en `dist/index.js` (154 planes, 24 apps, 4 planes, 5 kits y
el stack de referencia) proviene del estudio comparativo de agosto de 2026 y de
la planilla `KIMOS_Estudio_Mercado_Pricing.xlsx`. Precios de lista públicos en
USD, sin impuestos ni descuentos por volumen. **Conviene revalidarlo cada 6
meses**: en esta categoría las tarifas se mueven con frecuencia.

## Versiones

| Versión | Qué trae |
|---|---|
| **1.0.0** | Primera publicación. Siete pestañas, 154 planes de competencia con 140 verificados, modelo de precios recalculado en vivo, planes y kits con descuento y composición editables, configurador de cotización con banda de calibración, pros y contras por módulo, diagnóstico con puntajes editables, exportación CSV/JSON, persistencia por instancia, soporte de ⚙️ Configurar y 🗂️ Documentos, y agente IA con 14 acciones. |
