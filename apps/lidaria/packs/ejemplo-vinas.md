# Pack de ejemplo: viñas y bodegas

Muestra las dos cosas que un pack puede hacer:

1. **Añadir un rubro nuevo** (`kimos.vinas`) con su tolerancia, sus módulos
   prioritarios, su flujo, sus KPI y su material de prospección.
2. **Extender un rubro del producto** (`construccion`) con un flujo propio y una
   nota de normativa, sin copiar el rubro entero y sin tocar el catálogo base.

```bash
node tools/validar-pack.mjs packs/ejemplo-vinas.json   # valida
node tools/pack-rubro.mjs  packs/ejemplo-vinas.json    # empaqueta a .krub
```

Reglas que hacen esto seguro: un pack solo puede añadir o extender —nunca
borrar—, cada rubro queda marcado con su `origen` y eso se ve en pantalla, y el
validador rechaza módulos o equipos que no existan en el catálogo.
