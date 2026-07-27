// Genera definition.json usando la APP REAL, para que el harness del theme
// consuma exactamente el contrato que la app publica.
import fs from 'node:fs';
const cleanups = [];
globalThis.React = { createElement: (t,p,...c)=>({t,p,c}), Fragment:'f',
  useState:(v)=>[typeof v==='function'?v():v,()=>{}],
  useEffect:(fn)=>{const c=fn(); if(typeof c==='function')cleanups.push(c);}, useRef:(v)=>({current:v}) };
globalThis.window = { location:{origin:'http://k.local',href:'http://k.local/'}, confirm:()=>true, prompt:()=>null };
const store = new Map();
store.set('definition',{ id:'definition', kind:'definition',
  types:[{id:'other',label:'Otro'}],
  rules:{ currency:'CLP', currencySymbol:'$', locale:'es-CL', salesTaxPct:19, roundMode:'none' },
  public:{enabled:false,channels:[],data:null} });
let agentReg=null;
const shell = { app:{appId:'kimos.gestion-productos',instanceId:'i1',teamId:'t1'},
  assetUrl:(p)=>'http://k.local/'+p, notify:()=>{},
  items:{ list:async()=>Array.from(store.values()), create:async(i)=>{store.set(i.id,i);return i;},
    update:async(id,i)=>{store.set(id,{...store.get(id),...i});return store.get(id);}, remove:async(id)=>{store.delete(id);} },
  authFetch:async()=>({ok:true,json:async()=>({})}),
  agent:{register:(r)=>{agentReg=r;return()=>{};}},
  data:{listInstances:async()=>[],listItems:async()=>[]} };
// Ruta RELATIVA al propio kit: theme/test/ → raíz de la app (dist/index.js).
const { default: mount } = await import(new URL('../../dist/index.js', import.meta.url));
const app = mount(shell); app.Component({});
await new Promise(r=>setTimeout(r,60));
const act = async (t,p)=>{ const r=await agentReg.dispatchAction({type:t,payload:p}); if(!r.success) throw new Error(t+': '+r.error); return r; };

const GLB='mesa_hanoi_pack2.glb', TEX='wood_col.webp';
await act('UPSERT_PRODUCTO',{ name:'Pack 2 Hanoi', sku:'PACK-HANOI-2', priceMode:'fixed', fixedPrice:100000 });
const m3 = JSON.parse(fs.readFileSync(new URL('../../packs/mesa-hanoi/model3d-pack2.json', import.meta.url),'utf8'));
delete m3._comentario; m3.producto='Pack 2 Hanoi'; m3.url=GLB;
m3.finishes.forEach(f=>{f.texture=TEX;});
await act('SET_MODEL3D', m3);
await act('BUILD_3D_STEPS', { producto:'Pack 2 Hanoi' });
await act('PUBLISH_CONFIG', { enabled:true });

const data = store.get('definition').public.data;
// El producto de la tienda: le damos el id Jumpseller que usará el harness.
data.productos.forEach(p=>{ if(p.sku==='PACK-HANOI-2') p.productId=23008278; });
fs.writeFileSync('definition.json', JSON.stringify({data}, null, 2));
const e = data.productos.find(p=>p.sku==='PACK-HANOI-2');
console.log('pasos publicados:', e.groups.map(g=>g.label+' ['+g.values.map(v=>v.name).join('/')+']').join(' · '));
console.log('partes 3D:', e.model3d.parts.map(p=>p.id).join(', '));
console.log('efectos del 1er valor:', JSON.stringify(e.groups[0].values[0].model3d));
app.unmount(); cleanups.forEach(c=>{try{c()}catch(e){}}); process.exit(0);
