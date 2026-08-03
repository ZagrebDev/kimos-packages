# Proveedores de IA

## La idea

Los agentes **nunca** escriben sintaxis de un modelo concreto. Producen un
`PromptSpec` neutral y el registro lo traduce. Ese es el mecanismo que hace
sustituible cualquier proveedor sin tocar el núcleo.

```
Escena ──► specForScene() ──► PromptSpec neutral ──► renderPrompt(providerId)
                                                            │
                    ┌───────────────┬───────────────┬───────┴───────┐
                 Midjourney       FLUX          ComfyUI          Sora
                 --ar --v      prosa larga     grafo JSON     narración
```

## El PromptSpec

```js
{
  sceneId, sceneCode, role,
  subject,        // qué hay en cuadro
  action,         // qué ocurre
  environment,    // dónde
  mood, styleText, filmStock, paletteText, composition, productNote,
  shot, angle, lens, move, lighting, grade, fx: [],
  negative: [],   // qué evitar
  aspect, durationSec, refImages: [], audioNote,
}
```

## Contrato de un proveedor

```js
{
  id, label, vendor, capability,   // image | video | voice | music | sfx | text
  docs,
  aspects: ['16:9', '9:16'] | ['*'],
  minSec, maxSec,                  // solo vídeo/audio
  imageInput, nativeAudio,
  dialect: 'natural' | 'tags' | 'params' | 'lyrics',
  negative: bool,
  params: [{ key, label, type, default, min, max, options }],
  cost: { unit: 'image'|'second'|'char'|'call'|'ktoken', amount, currency },
  render(spec, opts) -> { text, negative?, params?, payload?, note? },
}
```

`render` es lo único obligatorio además de la identidad. Debe ser **puro** y no
lanzar: `renderPrompt` captura cualquier excepción y la devuelve como aviso, de
modo que un descriptor mal escrito degrada la calidad de un prompt pero nunca
rompe la campaña.

## Los cuatro dialectos

| Dialecto | Forma | Ejemplo |
|---|---|---|
| `natural` | Prosa de fotógrafo, frases completas | OpenAI Images, FLUX, Runway, Sora, Veo |
| `tags` | Términos por comas + negativo explícito | Stable Diffusion, ComfyUI |
| `params` | Descripción densa + flags | Midjourney (`--ar 16:9 --style raw --v 7`) |
| `lyrics` | Estilo separado de letra/estructura | Suno, Udio |

El mismo plano, en tres modelos:

```
Sora      The camera performs a very slow dolly push in, macro shot on a
          100mm macro lens. Chiaroscuro, single source, deep black falloff.

Midjourney  Aurora Serum, presented monumentally, dark minimalist set, macro
            shot, 100mm macro lens, chiaroscuro, noir grade --ar 16:9
            --style raw --stylize 250 --v 7 --no plástico, stock photo

Veo       Subject: Aurora Serum
          Camera: macro shot, low angle, 100mm macro lens, very slow dolly push in
          Lighting: chiaroscuro, single source, deep black falloff
          Audio: deep quiet room tone with a distant low hum
```

## Añadir un proveedor

### Permanente (en el bundle)

Añade el descriptor al array `PROVIDERS` en `src/16-providers.js`. Nada más:
`providersFor()`, los selectores de la UI, el cálculo de coste, los avisos de
duración y el CSV lo recogen automáticamente.

```js
{
  id: 'luma', label: 'Luma Dream Machine', vendor: 'Luma AI', capability: 'video',
  docs: 'https://lumalabs.ai/docs',
  aspects: ['16:9', '9:16', '1:1'], minSec: 5, maxSec: 9,
  imageInput: true, nativeAudio: false, dialect: 'natural', negative: false,
  params: [{ key: 'loop', label: 'Bucle', type: 'boolean', default: false }],
  cost: { unit: 'second', amount: 0.20, currency: 'USD' },
  render(spec, opts) {
    return {
      text: joinP([coreOf(spec) + '.', motionOf(spec) + '.', photoOf(spec) + '.'], ' '),
      params: { aspect_ratio: spec.aspect, loop: !!obj(opts).loop,
                keyframe: arr(spec.refImages)[0] || null },
    };
  },
}
```

Helpers disponibles para `render`: `coreOf` (sujeto + acción + entorno),
`photoOf` (encuadre, ángulo, óptica, luz, grade), `motionOf` (movimiento +
efectos), `negOf`, `enOf(LISTA, id)` y `joinP`.

### En caliente (desde el chat, sin tocar código)

```
REGISTER_PROVIDER {
  id: "mi-modelo", capability: "image",
  template: "RENDER :: {{subject}} | {{action}} | cam={{shot}} lens={{lens}} ar={{aspect}}",
  costPerUnit: 0.01, costUnit: "image"
}
```

Marcadores: `{{subject}}`, `{{action}}`, `{{environment}}`, `{{shot}}`,
`{{angle}}`, `{{lens}}`, `{{lighting}}`, `{{grade}}`, `{{move}}`, `{{fx}}`,
`{{style}}`, `{{palette}}`, `{{composition}}`, `{{mood}}`, `{{film}}`,
`{{product}}`, `{{negative}}`, `{{aspect}}`, `{{duration}}`, `{{code}}`.

Vive mientras la ventana esté abierta. Para hacerlo permanente, pásalo al
bundle.

## Coste

`cost.unit` decide qué se factura, y `billableQty` lo calcula desde el trabajo:

| Unidad | Cantidad |
|---|---|
| `image` / `call` | número de generaciones |
| `second` | duración de la toma |
| `char` | caracteres del texto (voz) |
| `ktoken` | tokens / 1000 |

El coste **estimado** sale de aquí. El **real** llega con `REGISTER_ASSET` o
`ADD_COST`, y Analytics muestra ambos con su desviación. Cuando la diferencia
es sistemática, corrige `cost.amount` del descriptor.

## Avisos automáticos

`renderPrompt` compara el spec con las capacidades declaradas y devuelve
`warnings`:

- El proveedor no soporta ese aspecto → se exportará y reencuadrará en edición.
- La escena dura más que `maxSec` → el Video Producer la divide en tomas
  encadenadas (la segunda parte del último fotograma de la primera).
- La escena dura menos que `minSec` → se recortará en edición.

Los avisos aparecen en la vista **Prompts** y viajan en el CSV.
