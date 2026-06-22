# Iconos — Lucide (ISC License)

Los archivos `*.svg` de esta carpeta provienen de [Lucide](https://lucide.dev)
y se redistribuyen bajo la licencia **ISC**. Se incrustan (embebidos) en
`../dist/index.js` para que la app funcione de forma nativa, sin depender de
ninguna URL externa en runtime.

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of
Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE,
DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS
ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS
SOFTWARE.
```

## Regenerar / añadir iconos

1. Descarga los SVG en esta carpeta:
   `curl -O https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/<nombre>.svg`
2. Vuelve a embeberlos en el bundle (extrae el cuerpo interno de cada SVG y
   reemplaza el objeto `BUILTIN_ICONS` de `dist/index.js`).
3. Si añades categorías nuevas, regístralas en `BUILTIN_CATEGORIES`.
