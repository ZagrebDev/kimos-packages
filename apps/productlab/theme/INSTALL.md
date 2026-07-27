# ProductLab — kit de theme Jumpseller

Configurador de productos por pasos para themes Jumpseller (probado sobre
Streamly). Lee el JSON público de la app ProductLab (version 2, clave
`productos`; acepta también version 1 con `equipos`) y cobra SIEMPRE el precio
de la variante Jumpseller seleccionada.

## Contenido del kit

| Archivo | Destino en el theme |
|---|---|
| `assets/configurador.js` | `assets/` (subir tal cual) |
| `assets/configurador.css` | `assets/` (subir tal cual) |
| `components/product-template.liquid` | reemplaza `components/product-template.liquid` (la rama `{% else %}` trae el template estándar de Streamly; en otro theme, pega ahí el original de ese theme) |
| `components/product-template.json` | fragmento: agrega sus `options` al `product-template.json` del theme |
| `partials/product_block.liquid` | fragmento: inserta el badge "Personalízalo" en el `product_block.liquid` del theme (contenedor de labels) |
| `config-options.snippet.json` | fragmento: opciones del badge para `config/options.json` + `config/settings.json` |
| `test/` | harness local (no se sube a la tienda) |

## Instalación

1. Sube `assets/configurador.js` y `assets/configurador.css` a los assets del theme.
2. Reemplaza `components/product-template.liquid` (o fusiona la rama
   personalizada si tu template ya está modificado). La rama personalizada se
   activa solo en productos con el **custom field `diseno = personalizado`**;
   el resto de productos sigue usando el template estándar.
3. Agrega las opciones de `components/product-template.json` (`kimos_url`,
   `pp_locale`, `pp_currency_prefix`) al `product-template.json` del theme.
4. (Opcional, badge en grillas) Inserta el fragmento de
   `partials/product_block.liquid` en el partial de bloque de producto del
   theme, y agrega las opciones de `config-options.snippet.json` a
   `config/options.json` y `config/settings.json`.
5. En el editor visual del producto → componente Template, pega la **URL
   pública del JSON** de la app ProductLab
   (`https://SU-KIMOS/api/public/app/{instancia}/definition`). Alternativa:
   `window.PP_KIMOS_URL` en `custom.js`.
6. Crea en Jumpseller las opciones/variantes del producto con los MISMOS
   nombres de pasos y valores que en la app (el matching es por nombre,
   insensible a mayúsculas). La app puede hacerlo por ti al "Aplicar".

## Los 7 puntos de acoplamiento con el theme anfitrión

1. **`product.fields`** — el custom field `diseno = personalizado` activa la
   rama personalizada del template y el badge de las grillas. Sin ese campo,
   nada cambia en el theme.
2. **`script.product-json`** — el template emite `{{ product | json }}` en un
   `<script type="application/json" class="product-json">`; el JS lee de ahí
   las variantes reales (precio/stock server-side).
3. **Selects nativos `.prod-options`** — ocultos en `.pp-variants-native`, con
   `data-optionid` / `data-optionname` y `option[data-name]`. El JS del
   configurador los maneja (incluidos los pasos condicionales ocultos, que
   quedan sincronizados en su valor por defecto) y dispara `change` con
   burbujeo: el listener de variantes del theme (p. ej.
   `Jumpseller.productVariantListener` en Streamly) sigue funcionando sin
   cambios.
4. **`product-form` + `button#add-to-cart`** — se conserva el custom element
   `<product-form>` del theme con su `product-form-json`, y el botón
   `#add-to-cart` (type=button → AJAX del theme; type=submit con
   notificaciones desactivadas o opciones tipo file). Cero duplicación de
   carro.
5. **Selector del header para la barra fija** — `updateBar()` busca
   `header, .theme-header, #header` y, si es fixed/sticky, cuelga la barra de
   pestañas justo debajo. Si tu theme usa otro selector, ajusta esa línea en
   `configurador.js`.
6. **Filtro `resize`** — el Liquid usa `| resize: '300'/'600'/'900'/'1000'/'1600'`
   para las imágenes del producto (estándar Jumpseller); verifica que tu theme
   lo soporte (todos los oficiales lo hacen).
7. **Bundle de color del theme** — la sección lleva
   `data-bundle-color="{{ component.options.bundle_color }}"`; el CSS consume
   `--color-links`, `--color-main`, `--color-background`, `--color-main-op*`,
   `--font-main`, `--font-secondary` con fallback a la paleta ProductLab
   (acento `#19ACB1`). `storefront.style` de la app puede sobreescribir
   acento/fondo/radio en runtime (`--pp-accent`, `--pp-bg`, `--pp-radius`).

Moneda/locale: `data-pp-locale` (default `es-CL`) y `data-pp-currency-prefix`
(default `$`) en el contenedor, expuestos como opciones del componente. El
cálculo de entrega usa días hábiles **lunes a viernes**.

## Probar con el harness local

```bash
cd apps/productlab/theme
python3 -m http.server 8000
# abrir http://localhost:8000/test/index.html
```

Sin red externa (imágenes SVG en data-URLs, visor 3D con `about:blank`). El
harness ejercita: paso condicional `dependsOn` (elige "Pack 2 soportes" en
Accesorio y aparece "Color del soporte"; vuelve a "Sin accesorio" y
desaparece con aviso), valor `neutral` y valor con `qty` ×2, dos secciones
`imagen` de alturas distintas (full y content con link), sección `visor3d`,
y `storefront.style` (accentColor violeta, radius 12, cardStyle list). Edita
`test/productlab.json` para probar `showDeltas: "total"/"none"`,
`stepsCollapsed: true` o `cardStyle: "compact"`; el JSON se cachea 3 min en
sessionStorage — recarga con la consola abierta y "Disable cache", o en una
ventana privada.
