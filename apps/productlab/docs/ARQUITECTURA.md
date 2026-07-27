# ProductLab — Arquitectura, herencia y funcionamiento

Documento de continuidad: todo lo que hay que saber para seguir desarrollando
ProductLab sin perder el conocimiento adquirido en las apps `computadores`
(hubpro.computadores v3.6.1) y `personalizador` (Personalizador 3D).

---

## 1. Mapa del ecosistema

```
┌───────────────────┐  productRef    ┌──────────────────┐   sync-push   ┌────────────┐
│ ProductLab        │ ─────────────► │ app products     │ ────────────► │ Ecommerce  │
│ (componentes,     │  PUT item:     │ (item producto)  │  backend      │ (Jumpseller│
│  costos, márgenes,│  price +       │                  │  KIMOS        │  hoy)      │
│  pasos, ficha,    │  options[] +   │                  │               │  producto  │
│  visual 3D)       │  variants[]    │                  │               │  opciones  │
└─────────┬─────────┘                └──────────────────┘               │  variantes │
          │ publica JSON público (permiso public.read)                  └──────┬─────┘
          ▼                                                                    ▼
GET /api/public/app/{instanceId}/definition ◄── theme/assets/configurador.js ◄── página
          │                                                              de producto
          ├──► ProductLab Visualizador (repo personalizador): ?def=…&producto=…
          └──► AR: GET /api/public/app/{instanceId}/ar/{sku}.glb?m=Material:hex
```

Repos:

| Repo | Rol |
|---|---|
| `kimos-packages` | **Esta app** (`apps/productlab`): bundle + theme kit + docs. Registro en el `manifest.json` raíz. |
| `kimos-enterprice` | Plataforma: AppShell, agentes, gateway público (`appPublicAPI.py`), datos entre apps (`appDataAPI.py`), push Jumpseller (`appInstancesAPI.py` + `integrations/jumpseller_sync.py`), AR GLB (`glb_materials.py`). |
| `personalizador` | **ProductLab Visualizador**: visor 3D web (Vite+R3F) embebible; lee el JSON público (`?def&producto`). |
| `computadores` | Origen histórico (app v3.6.1 + theme hubpro). Queda como referencia; el desarrollo continúa aquí. |
| `setup-kimos` | Aprovisionamiento de tenants. **No** participa en publicar apps. |

## 2. Los 4 hechos que fijan el diseño (heredados y vigentes)

1. **El push a Jumpseller solo existe para instancias del template `products`**
   (`appInstancesAPI.py`: `_push_item_to_integrations` rechaza otros
   templates). Por eso ProductLab escribe *a través* del item de products
   (`PUT /api/app-instances/{pInst}/items/{itemId}` con `shell.authFetch` +
   RBAC del usuario) y dispara `POST …/items/sync-push`.
2. **El precio por configuración se cobra con VARIANTES** (precio absoluto por
   combinación). Nunca calcular precio cobrable en JS del theme.
3. **La API de Jumpseller no tiene CORS**: todo pasa por el backend KIMOS.
4. **La presentación no cabe en el ecommerce** (imágenes por valor, specs,
   dependencias, entrega, estilo, 3D): viaja en el JSON público.

Reglas intocables heredadas:
- Los componentes jamás se pushean (no llevan `sourceLinks`).
- Opciones/variantes de productos aplicados son propiedad de la app (regenera
  y poda), preservando `sourceOptionId`/`sourceValueId`/`sourceVariantId` para
  actualizar en vez de recrear (carros y URLs `?variant_id` no se rompen).
- Renombrar una etiqueta genérica crea un valor nuevo en Jumpseller (matching
  por nombre normalizado): renombrar y re-aplicar de inmediato.
- Custom field `diseno=personalizado` activa la vista personalizada del theme;
  se asegura automáticamente al aplicar (warning no bloqueante).
- Caches en cadena: CDN ~10 min + `?_t` rotatorio 5 min + sessionStorage 3 min
  → cambios publicados visibles en ≤5-8 min.

## 3. Modelo de datos (items de la instancia)

- `definition` (único): `types[]` (tipos de componente, editables), `rules`
  (IVA, USD, base y márgenes, redondeos, staleDays, assemblyDays),
  `storeBaseUrl`, `public {enabled, data}` (lo que sirve el gateway).
- `component`: `{name, type, brand, specs, imageUrl, currency, cost, taxPct,
  supplierName, supplierUrl, verifiedAt, deliveryDays, stock (null = sin
  control), productRef?, tags[], requires[], excludes[], active, notes}`.
- `producto` (kind `producto`): `{name, sku, storeUrl, status, deliveryMode
  ('max'|'sum'), deliveryExtraDays, baseComponentIds[], extraCosts[],
  groups[], storefront{}, model3d{}, galleryImages[], productRef{instanceId,
  itemId, sourceId, sku, name, imageUrl}, price, lastPush{}}`.

### 3.1 Pasos (`groups[]`) — con las novedades ProductLab

```jsonc
{
  "id": "grp-…", "typeId": "material", "label": "Cubierta",
  "photoStep": false,                 // true = su selección cambia la foto (swatches)
  "dependsOn": {                      // NUEVO: paso condicional
    "stepId": "grp-anterior",         //   solo apunta a un paso ANTERIOR (sin ciclos)
    "valueIds": ["val-roble"]         //   visible solo si la selección está aquí
  },
  "defaultValueId": "val-roble",
  "values": [{
    "id": "val-…", "label": "Roble natural",
    "qty": 1,                         // NUEVO: unidades del componente elegido (≥1)
    "neutral": false,                 // NUEVO: true = valor $0 sin componentes (explícito)
    "imageUrl": "", "swatchColor": "",
    "componentIds": ["cmp-a", "cmp-b"] // pool de alternativas; se usa la más barata disponible
  }]
}
```

Semántica clave:
- **`qty`**: precio del valor = `qty × alternativa elegida`; disponibilidad
  exige `stock ≥ qty`. Permite "2×8GB" y "2×16GB" en un solo paso reutilizando
  el mismo componente.
- **`neutral`**: opción válida de $0. Es **explícito** a propósito: un valor
  que quedó sin componentes por accidente (componente eliminado) sigue siendo
  "no disponible", nunca gratis.
- **`dependsOn`**: la tienda oculta el paso si no se cumple; oculto se fuerza
  su default. Las variantes siguen siendo el **producto cartesiano completo**
  (Jumpseller exige un valor por opción en cada variante): las combinaciones
  imposibles existen pero el cliente no puede seleccionarlas. Por eso el
  default de un paso dependiente debe ser **neutro** — la app lo advierte si
  no lo es (se cobraría oculto).
- `normalizeDependsOn()` sanea al guardar: solo pasos anteriores, solo valores
  existentes; lo inválido se descarta.

### 3.2 Ficha (`storefront`)

- `pageSections[]` — builder por secciones ordenadas:
  - `hero` (repetible): patrón flexbox (12), bloques (9 tipos) por contenedor,
    `height` ahora acepta `'auto'`; bloques `photo`/`gallery` aceptan
    `size:'auto'` (alto natural de la foto).
  - `imagen` (repetible, **NUEVO**): `{imageUrl, alt, width:'content'|'full',
    link}` — solo una foto cuyo **alto se adapta a la imagen** (sin recortes).
    Resuelve descripciones hechas de muchas fotos apiladas de alturas
    distintas.
  - `visor3d` (única, **NUEVO**): `{height}` — embebe el visualizador 3D
    (`model3d.embedUrl`) en esa posición.
  - `specs` / `fotos` / `note` (fijas): existen una vez, se reordenan/ocultan.
- `specs[]`, `photosNote`, `tabs{}` — igual que la herencia.
- `style{}` (**NUEVO**): `{accentColor, bgColor, radius (0-24), cardStyle
  ('cards'|'list'|'compact'), showDeltas ('delta'|'total'|'none'),
  stepsCollapsed}` — personalización del configurador/página por producto;
  vacío = theme del sitio. El previsualizador de Pasos lo refleja.

### 3.3 Visualizador 3D (`model3d`)

```jsonc
{
  "enabled": true,
  "viewerUrl": "https://visualizador.mitienda.cl/",  // visor desplegado (repo personalizador)
  "modelUrl": "https://cdn/…/producto.glb",          // GLB (meshopt+WebP recomendado)
  "arUrl": "/api/public/files/imagenes/productlab/producto-ar.glb",  // AR (allowlist del backend)
  "bindStepId": "grp-…",                              // paso que elige textura/acabado en el visor
  "config": {                                         // contrato del visor (docs/VISUALIZADOR.md)
    "parts":    [{ "id": "superficie", "label": "Superficie", "materials": ["Mat1"] }],
    "finishes": [{ "id": "roble", "label": "Roble", "color": "#ffffff",
                   "texture": "https://…/roble.webp", "roughness": 0.7,
                   "textureScale": 0.09, "grain": 0.3 }],
    "palette":  ["#f4f4f5", "#0a0a0a"]
  }
}
```

Publicado en el JSON con `embedUrl` calculado
(`viewerUrl?def=<publicUrl>&producto=<sku>`). El backend además sirve
`GET /api/public/app/{instanceId}/ar/{sku}.glb?m=Material:hex,Otro:hide`
parcheando colores del GLB al vuelo (`glb_materials.py`) — usa `arUrl`.

## 4. JSON público (contrato version 2)

`GET {KIMOS}/api/public/app/{instanceId}/definition` → envoltorio
`{instanceId, data}`. El theme y el visor desenvuelven y aceptan
`data.productos || data.equipos` (compatibilidad con la herencia).

```jsonc
{
  "version": 2, "updatedAt": "…", "currency": "CLP", "store": "productlab",
  "productos": [{
    "sku": "PL-…", "productId": "424242", "name": "…",
    "basePrice": 345990, "deliveryDays": 5, "assemblyDays": 3,
    "deliveryMode": "max", "baseDeliveryDays": 2, "imageUrl": "…",
    "storefront": { "pageSections": […], "specs": […], "photosNote": "…",
                    "tabs": {…}, "style": {…} },
    "model3d": { "enabled": true, "viewerUrl": "…", "modelUrl": "…",
                 "arUrl": "…", "bindStepId": "…", "config": {…}, "embedUrl": "…" } | null,
    "groups": [{
      "id": "…", "label": "Cubierta", "type": "material", "affectsPhoto": false,
      "dependsOn": { "groupId": "…", "valueIds": ["…"] } | null,
      "values": [{ "id": "…", "name": "Roble", "qty": 1, "neutral": false,
                   "desc": "…", "swatchColor": "", "imageUrl": "…", "delta": 0,
                   "deliveryDays": 3, "tags": [], "requires": [], "excludes": [],
                   "isDefault": true }]
    }]
  }]
}
```

Notas: no expone costos, proveedores ni marcas de alternativas. Un paso sin
valores disponibles no se publica; un valor sin stock suficiente (según su
`qty`) se excluye. `delta` es presentacional (fallback): el precio real es la
variante.

## 5. Agentes (cómo interactúa el agente KIMOS con la app)

Todo lo aprendido en la saga de computadores está incorporado:

- **Registro**: `shell.agent.register({label, description, tools[], getSnapshot,
  dispatchAction})` con permiso `agent.control`. Las tools viajan al prompt en
  `[APP_CAPS]` (nombre, params, required) y el snapshot en `[CTX]`. La app solo
  está registrada con su ventana abierta: el agente la ve en `[APPS_CERRADAS]`
  y la abre con `OPEN_APP`.
- **`builderRef` en el snapshot**: contrato exacto del builder
  (`sectionShape`, `blockSchema`, `example`, `patterns[].containers`,
  `heights` con `auto`, `extraSections: imagen/visor3d`). La regla 16 del
  system prompt instruye a copiar estos esquemas.
- **`COMPOSE_HERO`**: el agente entrega campos planos y la app compone la
  estructura — el único fix definitivo a los fallos de formato de LLM.
- **Validación estricta + errores didácticos**: todo rechazo lista los valores
  válidos (productos existentes, contenedores del patrón, tipos de bloque,
  ejemplo mínimo inline) para autocorrección en el siguiente turno; guardia
  anti-borrado (`allowEmpty`); alias de payload (`producto`/`productoId`/
  `id`/`name`/`sku`; payloads como string JSON se parsean).
- **El checker del chat NO valida estructura** (solo ruteo/fugas/PII/
  destructivos, fail-open): la validación real vive en `dispatchAction`.
- Memoria de agentes: persistente en Firestore
  (`firestore_session_service.py`); diagnóstico en `/api/public/healthz`.

## 6. Decisiones de ProductLab (nuevas)

| Decisión | Motivo |
|---|---|
| `neutral` explícito (no inferido de `components: []`) | Un componente eliminado no puede convertir una opción con precio en gratis. |
| Variantes = cartesiano completo aun con `dependsOn` | Jumpseller exige un valor por opción en cada variante; el theme fuerza el default del paso oculto. Default neutro ⇒ el precio oculto es $0. |
| `qty` a nivel de valor (no de componente) | Permite "2×8" y "2×16" con el mismo pool de alternativas; el stock se exige por cantidad. |
| Secciones `imagen` con alto natural | Las alturas fijas (s/m/l/xl) recortaban fotos de descripciones apiladas; `auto` también en bloques photo/gallery y en heros. |
| Visor 3D como app separada embebida (iframe) | El host de apps solo expone React (no three.js); un bundle con three rompería la convención "fuente = dist legible". El visor ya existe (repo personalizador) y se integra por URL + postMessage. |
| `model3d.arUrl` | Reutiliza el gateway AR existente del backend (`/ar/{ref}.glb` + `glb_materials.py`). |
| JSON `productos` + fallback `equipos` en el theme kit | Migración suave desde instalaciones hubpro. |
| Parche backend: persistir `permissions` en installs de registry | Sin él, las apps oficiales con `public.read`/`data.read:*` recibían 403 del gateway (por eso hubpro era sideload-only). |

## 7. Limitaciones conocidas y roadmap corto

- **Stock por variante en Jumpseller**: las variantes se generan sin stock; la
  elegibilidad se controla en la app (pendiente heredado #4).
- **Detalle de la alternativa interna en el pedido**: evaluar *order notes*
  (pendiente heredado #6).
- Días hábiles L-V sin feriados; moneda CLP en la app (el theme kit ya
  parametriza locale/prefijo).
- Máx 400 variantes por producto (límite real del cartesiano).
- `saveData(scope:'team')` no soportado por la plataforma (no se usa).
- El visor 3D exige CORS abierto en GLB y texturas.

## 8. Cómo publicar una nueva versión

1. Editar `apps/productlab/dist/index.js` (la fuente ES el dist, ESM legible,
   sin build; React del host vía `globalThis.React`, sin JSX).
2. `node apps/productlab/test/test-app.mjs` (siempre; ha cazado todos los bugs).
3. Bump de `version` en `apps/productlab/manifest.json` **y** en el
   `manifest.json` raíz (deben ir en sync; el backend instala desde el raíz).
4. Merge a `main` → Tienda KIMOS → Actualizar (`?force=1` salta la caché de
   5 min). El bundle se sirve con `?v=<versión>` (immutable correcto).
5. Si cambió el contrato del JSON público: actualizar también
   `theme/assets/configurador.js` y el visor (repo personalizador), y probar
   con `theme/test/` (harness local sin producción).
