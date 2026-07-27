// Verifica que el pack Mesa Hanoi reproduce EXACTAMENTE la config del
// personalizador (src/catalog.ts) al aplicarlo por las tools del agente.
import fs from 'node:fs';

globalThis.React = {
  createElement: (t, p, ...c) => ({ t, p, c }),
  Fragment: 'fragment',
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: (fn) => { const c = fn(); if (typeof c === 'function') cleanups.push(c); },
  useRef: (v) => ({ current: v }),
};
const cleanups = [];
globalThis.window = { location: { origin: 'http://k.local', href: 'http://k.local/' }, confirm: () => true, prompt: () => null };

const store = new Map();
store.set('definition', {
  id: 'definition', kind: 'definition',
  types: [{ id: 'acabado', label: 'Acabado' }, { id: 'other', label: 'Otro' }],
  rules: { currency: 'CLP', currencySymbol: '$', locale: 'es-CL', salesTaxPct: 19, marginDefaultPct: 25, roundMode: 'none' },
  public: { enabled: false, channels: [], data: null },
});
let agentReg = null;
const shell = {
  app: { appId: 'kimos.gestion-productos', instanceId: 'i1', teamId: 't1' },
  assetUrl: (p) => 'http://k.local/api/apps/kimos.gestion-productos/asset/' + p,
  notify: () => {},
  items: {
    list: async () => Array.from(store.values()),
    create: async (i) => { store.set(i.id, i); return i; },
    update: async (id, i) => { store.set(id, { ...store.get(id), ...i }); return store.get(id); },
    remove: async (id) => { store.delete(id); },
  },
  authFetch: async () => ({ ok: true, json: async () => ({}) }),
  agent: { register: (r) => { agentReg = r; return () => {}; } },
  data: { listInstances: async () => [], listItems: async () => [] },
};

const { default: mount } = await import(new URL('../../dist/index.js', import.meta.url).href);
const app = mount(shell);
app.Component({});
await new Promise((r) => setTimeout(r, 60));

const act = async (type, payload) => {
  const r = await agentReg.dispatchAction({ type, payload });
  if (!r.success) throw new Error(type + ' falló: ' + r.error);
  return r;
};
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? '  ✔ ' : '  ✘ ') + label + ': ' + JSON.stringify(got));
  if (!ok) throw new Error(label + ' ≠ ' + JSON.stringify(want));
};

const base = new URL('./', import.meta.url).pathname;
const m3 = JSON.parse(fs.readFileSync(base + 'model3d.json', 'utf8'));
const st = JSON.parse(fs.readFileSync(base + 'pasos.json', 'utf8'));
const GLB = 'http://k.local/api/public/files/imagenes/gestion-productos/modelos/abc-mesa_hanoi.glb';
const TEX = 'http://k.local/api/public/files/imagenes/gestion-productos/def-wood_col.webp';

// Prerrequisitos que el README pide: producto + componentes con costo.
await act('UPSERT_PRODUCTO', { name: 'Mesa Hanoi', sku: 'HANOI-1' });
await act('UPSERT_COMPONENT', { name: 'Barniz natural', type: 'acabado', cost: 12000 });
await act('UPSERT_COMPONENT', { name: 'Tinte carbonizado', type: 'acabado', cost: 18000 });

// 1) Aplicar el pack, sustituyendo los placeholders como indica el README.
delete m3._comentario;
m3.url = GLB;
m3.finishes.forEach((f) => { f.texture = TEX; });
await act('SET_MODEL3D', m3);
delete st._comentario;
await act('SET_PRODUCTO_STEPS', st);

// 2) Comparar con la definición del personalizador (src/catalog.ts).
const got = agentReg.getSnapshot().productos.find((e) => e.name === 'Mesa Hanoi');
const saved = Array.from(store.values()).find((x) => x.kind === 'producto' && x.name === 'Mesa Hanoi');
const M = saved.model3d;

console.log('\n── Modelo ──');
eq('rotación', M.rotation.map((x) => Number(x.toFixed(10))), [-1.5707963268, 0, 3.1415926536]);
eq('espejo', M.mirror, true);
eq('publicado', M.publish, true);

console.log('── Partes ──');
eq('cantidad', M.parts.length, 2);
const sup = M.parts.find((p) => p.id === 'superficie');
const est = M.parts.find((p) => p.id === 'estructura');
eq('superficie: materiales', sup.materials, ['Pino']);
eq('superficie: color/acabado', [sup.defaultColor, sup.defaultFinish], ['#c8a165', 'natural']);
eq('estructura: materiales', est.materials, ['Pino_-_Brillante', 'Travesano']);
eq('estructura: color/acabado', [est.defaultColor, est.defaultFinish], ['#8a6642', 'natural']);
eq('estructura: veta vertical', est.grainVertical, true);
eq('estructura: inclinación', est.grainAngle, 0.24);
eq('estructura: veta a lo largo', est.grainAlongMaterials, ['Travesano']);

console.log('── Acabados ──');
const nat = M.finishes.find((f) => f.id === 'natural');
const car = M.finishes.find((f) => f.id === 'carbonizado');
eq('natural', [nat.color, nat.roughness, nat.textureScale, nat.grain, nat.triplanar], ['#ffffff', 0.7, 0.09, 0.3, true]);
eq('carbonizado', [car.color, car.roughness, car.textureScale, car.grain, car.triplanar], ['#3f4147', 0.4, 0.09, 1, true]);
eq('ambos comparten textura', nat.texture === car.texture && nat.texture === TEX, true);

console.log('── Pasos y efectos ──');
eq('pasos', got.steps.map((s) => s.label), ['Acabado de la superficie', 'Acabado de la estructura']);
eq('efecto superficie/carbonizado', saved.groups[0].values[1].model3d, [{ partId: 'superficie', type: 'finish', finishId: 'carbonizado' }]);
eq('efecto estructura/natural', saved.groups[1].values[0].model3d, [{ partId: 'estructura', type: 'finish', finishId: 'natural' }]);
eq('valores vendibles (con componente disponible)', got.steps.map((s) => s.values.every((v) => v.available)), [true, true]);
eq('combinaciones para la tienda', got.variantCombos, 4);

console.log('\n── Estado 3D que recibiría el motor ──');
// Réplica de build3dState: por defecto ambas partes en "natural".
const pub = (await act('PUBLISH_CONFIG', { enabled: true }), store.get('definition').public.data);
const p3 = pub.productos.find((e) => e.name === 'Mesa Hanoi');
eq('contrato 3D publicado al theme', [p3.model3d.url === GLB, p3.model3d.parts.length, p3.model3d.finishes.length], [true, 2, 2]);

// ── Pack de 2 unidades: el JSON debe referenciar materiales que EXISTAN ──
// en el GLB generado. Un nombre mal escrito deja la parte muerta en silencio,
// así que se compara contra los materiales reales del archivo.
console.log('\n── Pack de 2 unidades ──');
const glb2 = fs.readFileSync(base + 'mesa_hanoi_pack2.glb');
let o2 = 12, meta = null;
while (o2 < glb2.length) {
  const len = glb2.readUInt32LE(o2), ty = glb2.readUInt32LE(o2 + 4);
  if (ty === 0x4e4f534a) { meta = JSON.parse(glb2.subarray(o2 + 8, o2 + 8 + len).toString('utf8')); break; }
  o2 += 8 + len;
}
const enGlb = (meta.materials || []).map((m) => m.name).sort();
eq('materiales del GLB del pack', enGlb, ['Pino_-_Brillante_1', 'Pino_-_Brillante_2', 'Pino_1', 'Pino_2', 'Travesano_1', 'Travesano_2']);
const m3p = JSON.parse(fs.readFileSync(base + 'model3d-pack2.json', 'utf8'));
const usados = m3p.parts.reduce((a, p) => a.concat(p.materials, p.grainAlongMaterials || []), []);
const huerfanos = usados.filter((n) => enGlb.indexOf(n) === -1);
eq('todos los materiales del JSON existen en el GLB', huerfanos, []);
eq('una parte por unidad y zona', m3p.parts.map((p) => p.id), ['superficie_1', 'estructura_1', 'superficie_2', 'estructura_2']);
// Cada unidad usa materiales SOLO de su unidad (si no, un paso repintaría la otra).
const cruce = m3p.parts.filter((p) => {
  const u = p.id.endsWith('_1') ? '_1' : '_2';
  return p.materials.some((n) => !n.endsWith(u));
});
eq('ninguna parte mezcla materiales de las dos unidades', cruce.map((p) => p.id), []);

console.log('\nPack Mesa Hanoi verificado ✔ — coincide con src/catalog.ts');

app.unmount();
cleanups.forEach((c) => { try { c(); } catch (e) {} });
process.exit(0);
