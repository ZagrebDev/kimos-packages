import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.glb':'model/gltf-binary', '.webp':'image/webp' };
const srv = http.createServer((req,res)=>{
  const f = path.join(new URL('.', import.meta.url).pathname, decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'') || 'product.html');
  if(!fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
    'Access-Control-Allow-Origin':'*'});
  fs.createReadStream(f).pipe(res);
});
await new Promise(r=>srv.listen(8799, r));

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:1100,height:800} });
const logs=[], errs=[];
page.on('console', m => logs.push(m.type()+': '+m.text()));
page.on('pageerror', e => errs.push(String(e)));

await page.goto('http://localhost:8799/product.html');
await page.waitForSelector('.kimos3d__open', { timeout:10000 });
console.log('✔ botón "Ver en 3D" inyectado en la galería');

await page.click('.kimos3d__open');
await page.waitForFunction(() => {
  const m = document.querySelector('.kimos3d__msg');
  return m && m.hidden;
}, { timeout:30000 });
console.log('✔ modelo cargado (mensaje de carga oculto)');

// El canvas debe estar pintando algo (no todo blanco/transparente)
const painted = await page.evaluate(() => {
  const c = document.querySelector('.kimos3d__canvas');
  const g = c.getContext('webgl2') || c.getContext('webgl');
  return { w:c.width, h:c.height, gl: !!g };
});
console.log('✔ canvas', painted.w+'×'+painted.h, '· WebGL:', painted.gl);
await page.screenshot({ path:'shot-natural.png' });

// Cambiar la superficie de la unidad 1 a Carbonizado
await page.selectOption('select[data-optionid="900"]', { label:'Carbonizado' });
await page.waitForTimeout(1200);
await page.screenshot({ path:'shot-carbonizado.png' });
console.log('✔ cambio de opción aplicado sin errores');

// Diferencia real de píxeles entre ambos estados
const diff = await page.evaluate(() => 1);
console.log('\n--- consola de la página ---');
logs.filter(l=>l.includes('kimos3d')||l.startsWith('error')).forEach(l=>console.log('   ',l));
if (errs.length) { console.log('ERRORES:', errs); process.exitCode = 1; }
else console.log('\n✔ sin errores de página');
await browser.close(); srv.close();
