# ProductLab — Visualizador 3D y AR

El visor 3D de ProductLab es la evolución del **Personalizador 3D** (repo
`personalizador`, ahora "ProductLab Visualizador"): una app web Vite + React
+ three.js (react-three-fiber) que renderiza el producto con partes y
texturas personalizables en tiempo real, embebible por iframe.

---

## 1. Arquitectura

```
ProductLab (app KIMOS)                    ProductLab Visualizador (repo personalizador)
  producto.model3d ──publica──► JSON ──►  ?def=<url definición>&producto=<sku>
  card "Visualizador 3D"                  lee model3d.{modelUrl, config} y renderiza
  sección builder "visor3d"  ──iframe──►  postMessage: ready / select / set
Backend kimos-enterprice
  GET /api/public/app/{instanceId}/ar/{sku}.glb?m=Mat:hex  (AR: GLB parcheado al vuelo)
```

- La app guarda `model3d` por producto y lo publica en el JSON público con
  `embedUrl` calculado (`viewerUrl?def=…&producto=…`).
- El theme kit embebe `embedUrl` donde el builder tenga la sección `visor3d`.
- La app misma muestra el visor en vivo (card Visualizador 3D y sección del
  builder) para gestionar cómo se ve sin salir de ProductLab.

## 2. Contrato `model3d.config`

```jsonc
{
  "parts": [{
    "id": "superficie",            // id lógico de la parte
    "label": "Superficie",         // etiqueta visible en el panel del visor
    "materials": ["Pino", "M1"],   // nombres de MATERIAL dentro del GLB que controla
    "defaultColor": "#c8a165",     // color si no hay finishes
    "defaultFinish": "roble",      // acabado inicial (si hay finishes)
    "grainVertical": false,        // la textura corre vertical (piezas de pie)
    "grainAngle": 0                 // inclinación en radianes (piezas inclinadas)
  }],
  "finishes": [{                   // acabados: textura + tinte + rugosidad
    "id": "roble", "label": "Roble",
    "color": "#ffffff",            // tinte multiplicado (blanco = textura tal cual)
    "texture": "https://…/roble.webp",  // proyección triplanar (ignora UVs del CAD)
    "roughness": 0.7,
    "textureScale": 0.09,          // texels por unidad: menor = textura más grande
    "grain": 0.3,                  // cuánto modula la textura el brillo
    "plywood": false,              // capas de terciado en los cantos
    "plySpacing": 0.0018
  }],
  "palette": ["#f4f4f5", "#0a0a0a"]   // paleta libre para partes SIN finishes
}
```

Los nombres de `materials` se obtienen del GLB (los asigna el pipeline de
conversión — ver README del repo personalizador). Técnica heredada: proyección
**triplanar** de la textura en espacio del objeto (shader inyectado en
MeshStandardMaterial), la luminancia modula la rugosidad (la textura se lee en
los reflejos incluso con tintes oscuros), soporte de capas de terciado en
cantos.

## 3. Modos del visor

| URL | Modo |
|---|---|
| `viewerUrl/` | Demo: catálogo local del repo (productos de muestra) |
| `viewerUrl/?def=<url>&producto=<sku>` | **Dinámico**: carga model3d del JSON público |
| `…&ui=min` | Solo el visor 3D (sin panel) — para embeber pequeño |

## 4. API postMessage (embebido)

Del visor al host:
- `{ source: 'productlab-viewer', type: 'ready', producto }` — modelo cargado.
- `{ source: 'productlab-viewer', type: 'select', partId, finishId?, color? }`
  — el usuario cambió un acabado/color.

Del host al visor:
- `{ source: 'productlab', type: 'set', partId, finishId?, color? }` — aplicar
  selección desde fuera (p. ej. sincronizar con el paso `bindStepId` del
  configurador: el theme puede mapear el valor elegido del paso a un
  `finishId` del mismo nombre/id).

## 5. AR (Android Scene Viewer / Quick Look vía GLB)

El backend sirve el modelo con colores aplicados **sin generar un GLB por
combinación**:

```
GET /api/public/app/{instanceId}/ar/{sku}.glb?m=Pino:c8a165,Travesano:hide
```

- Requiere `public.read` + publicación activa; el GLB base sale de
  `producto.model3d.arUrl`, que debe ser una ruta **`/api/public/files/…`**
  del File Storage de KIMOS (allowlist del backend; máx 40 MB).
- `m` = pares `Material:hex` (o `hide` para ocultar), máx 40; parchea
  `baseColorFactor` en el chunk JSON del GLB (`glb_materials.py`).
- El theme kit muestra el link "Ver en tu espacio (AR)" cuando `arUrl` existe.

## 6. Pipeline de modelos (herencia)

El repo personalizador conserva el pipeline completo:
OBJ (CLO/Fusion) → `obj2gltf` + `gltf-transform` (weld → simplify → meshopt +
WebP 1024px); STEP (CAD) → MayoConv + asignación de materiales por nombre de
nodo + Blender headless opcional (bevel). Resultado típico: catálogo completo
de 2,6 MB vs 446 MB de OBJ originales. Los materiales del GLB son los ids que
usa `config.parts[].materials`.

## 7. Requisitos de despliegue

- Visor: hosting estático (build de Vite del repo personalizador). Puede vivir
  en Firebase Hosting del tenant o cualquier CDN.
- **CORS**: el GLB (`modelUrl`) y las texturas (`finishes[].texture`) deben
  servirse con CORS abierto (el visor puede estar en otro origen). El endpoint
  `/definition` ya responde CORS `*`.
- Rendimiento móvil heredado: `frameloop="demand"`, dpr ≤ 1.75, meshopt, sin
  shadow maps.
