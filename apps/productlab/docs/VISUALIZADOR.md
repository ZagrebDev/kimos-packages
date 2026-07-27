# ProductLab — Visor 3D y AR (v2.0.0)

El 3D de ProductLab tiene **dos anfitriones con un mismo núcleo** y una cadena
AR completa, heredados de la app gestion-productos (repo personalizador).

---

## 1. Piezas

| Pieza | Qué es |
|---|---|
| `engine-src/engine3d.js` (+ `wood.js`, `qr.js`) | Núcleo del motor: three.js **vanilla** (sin React) — así el MISMO código corre dentro del React del host de KIMOS y en el theme sin framework. |
| `assets/engine3d.js` | Build ESM para la APP (`npm run build:engine`). **Carga diferida**: `import(shell.assetUrl('engine3d.js'))` solo cuando un producto tiene 3D. |
| `theme/kimos-engine3d.js` | Build IIFE (`KimosEngine3D`) para el theme (`npm run build:engine:theme`). |
| Repo `personalizador` (main) | **ProductLab Visualizador** standalone (Vite + R3F): visor independiente/demo con modo dinámico `?def=…&producto=…` y API postMessage. Opcional — el visor integrado de app y theme es engine3d. |

## 2. Configuración por producto (`model3d`)

Se edita en la pestaña **Visor 3D** del producto (o con `SET_MODEL3D` /
`BUILD_3D_STEPS`):

```jsonc
{
  "enabled": true, "publish": true,          // publish: viaja al JSON público
  "url": "https://…/mesa.glb",               // GLB (meshopt); subida hasta 60 MB
  "rotation": [-1.5708, 0, 3.1416], "mirror": true,
  "realSizeCm": 120,                          // lado mayor real; 0 = SIN AR
  "arUrl": "…/mesa-ar.glb",                   // GLB a escala real (se genera desde el visor)
  "parts": [{ "id": "superficie", "label": "Superficie",
              "materials": ["Pino"],          // nombres EXACTOS de material del GLB
              "defaultColor": "#c8a165", "defaultFinish": "natural",
              "grainVertical": false, "grainAngle": 0, "grainAlongMaterials": [] }],
  "finishes": [{ "id": "natural", "label": "Natural", "color": "#ffffff",
                 "texture": "https://…/wood.webp", "roughness": 0.7,
                 "textureScale": 0.09, "grain": 0.3, "triplanar": true }]
}
```

**Binding pasos ↔ 3D**: cada VALOR de un paso lleva efectos
`model3d: [{partId, type: 'color'|'finish'|'hide', color?, finishId?}]` — la
selección del cliente repinta el modelo en vivo (`build3dState` acumula
colors/finishes/hidden → `viewer.setState`). El botón **⚡ Generar pasos desde
el modelo 3D** (o `BUILD_3D_STEPS`, con `append` para packs multi-unidad) crea
un paso por parte y un valor por acabado con los efectos ya vinculados.

API del motor: `createViewer(canvas)` → `setModel / setParts / setFinishes /
setState / materialNames / frame / snapshot / arSupported / startAR /
startLiveAR / exportUSDZ / exportGLB / dispose`. Claves de recarga separadas:
cambiar un color NUNCA re-descarga el GLB.

## 3. Cadena AR (conocimiento duro ganado a pulso)

Solo se ofrece AR si `realSizeCm > 0` (colocar un mueble a escala inventada
engaña al cliente).

1. **Android — Scene Viewer**: `intent://arvr.google.com/scene-viewer/…` con
   `file=` apuntando al gateway del backend
   `GET /api/public/app/{instanceId}/ar/{ref}.glb?m=Material:hex,Otro:hide` —
   el GLB (`model3d.arUrl`, allowlist `/api/public/files/…`, máx 40 MB) se
   **parchea al vuelo** con la configuración elegida (`glb_materials.py`). El
   href se recalcula en `pointerdown` para llevar la configuración del momento.
2. **iPhone — AR Quick Look**: `.usdz` generado **en el navegador** con
   `exportUSDZ({realSizeCm})`. Aprendizajes horneados en el código: USDZ no
   admite escalas negativas (el `mirror` se hornea en los vértices), la
   orientación de caras se mide contra las normales (algunos GLB vienen
   invertidos), y la proyección **triplanar se hornea a UV** (≤1024px) — sin
   eso la madera salía plástica. Si el cliente cambia una opción, el blob se
   revoca y se regenera.
3. **Escritorio — puente QR**: QR propio (`qrMatrix`, margen quieto de 4
   módulos) hacia esta misma ficha con `?kimos_ar=1`.
4. **AR en vivo (opcional) — 8th Wall Engine**: cámara en la propia página con
   el producto EXACTO del configurador (mismo objeto/materiales). Se activa
   con `window.KIMOS_XR8_URL`; el binario (~2,1 MB gzip) solo se descarga al
   pulsar, puede autoalojarse, y su licencia (Niantic Spatial) es **revocable
   y exige atribución** ("AR: 8th Wall Engine © Niantic Spatial"). Si falla,
   cae solo a Scene Viewer / Quick Look.

## 4. Visor standalone (repo personalizador, opcional)

El visor Vite/R3F acepta `?def=<URL del definition>&producto=<sku|productId>`
y `?ui=min`, lee `model3d` del JSON público (`url`, `parts`, `finishes`) y
expone postMessage (`ready`/`select` salientes, `set` entrante). Útil como
página independiente o embed externo; requiere CORS abierto en GLB y texturas.

## 5. Packs

`packs/mesa-hanoi/`: ejemplo completo real — `model3d.json` (payload de
`SET_MODEL3D`), `pasos.json` (payload de `SET_PRODUCTO_STEPS` con efectos),
`build-pack2.mjs` (genera el GLB de 2 unidades a partir del de 1) y
`verify.mjs`. Patrón recomendado para empaquetar cualquier producto 3D.
