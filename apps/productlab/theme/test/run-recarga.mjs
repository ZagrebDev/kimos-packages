// ¿Cambiar un color obliga a volver a descargar el .glb? Se cuentan las
// peticiones reales al archivo, que es lo que el usuario ve como "Cargando…".
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = path.dirname(new URL(import.meta.url).pathname) + '/..';
let descargas = 0;
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/m.glb') { descargas++; r.writeHead(200, {'Content-Type':'model/gltf-binary'}); return fs.createReadStream(T+'/../packs/mesa-hanoi/mesa_hanoi.glb').pipe(r); }
  if (u === '/p.html') { r.writeHead(200, {'Content-Type':'text/html'}); return r.end('<canvas id=c style="width:300px;height:300px"></canvas><script src="/kimos-engine3d.js"></script>'); }
  const f = path.join(T, u.replace(/^\//,''));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('x'); }
  r.writeHead(200, {'Content-Type':'text/javascript'}); fs.createReadStream(f).pipe(r);
});
await new Promise(x => srv.listen(8806, x));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.goto('http://localhost:8806/p.html');
await p.evaluate(async () => {
  window.v = KimosEngine3D.createViewer(document.getElementById('c'), { podium:false });
  await window.v.setModel({ url:'/m.glb', rotation:[-1.5707963267948966,0,3.141592653589793], mirror:true,
    parts:[{ id:'s', label:'S', materials:['Pino'], defaultColor:'#c8a165' }] });
});
const tras1 = descargas;
// Cambiar el color de la parte: NO debe volver a bajar el archivo.
await p.evaluate(async () => {
  await window.v.setParts([{ id:'s', label:'S', materials:['Pino'], defaultColor:'#3f4147' }]);
  window.v.setFinishes([{ id:'f', label:'F', color:'#3f4147', roughness:0.4 }]);
  window.v.setState({ colors:{ s:'#112233' }, finishes:{}, hidden:{} });
});
await p.waitForTimeout(400);
console.log('descargas del .glb tras cargar:', tras1);
console.log('descargas tras cambiar color, partes, acabados y estado:', descargas);
await b.close(); srv.close();
if (tras1 !== 1 || descargas !== 1) { console.error('✘ el modelo se volvió a descargar'); process.exit(1); }
console.log('✔ cambiar colores no recarga el modelo');
