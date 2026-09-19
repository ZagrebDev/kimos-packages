/**
 * Monta la app de verdad en jsdom, abre la pestaña Puente y comprueba la
 * tarjeta de credenciales: que aparece, que el .env se rellena con lo que se
 * escribe, y que nada de eso se guarda (saveData no recibe ninguna credencial).
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>', { url: 'https://kimos.example/app' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// react-dom se importa DESPUÉS de que exista el DOM: si se importa antes, su
// sistema de eventos se inicializa sin ventana y ningún onChange llega.
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
globalThis.React = React;
dom.window.fetch = async () => { throw new TypeError('sin red en la prueba'); };
globalThis.fetch = dom.window.fetch;

const guardados = [];
const noop = () => {};
const rama = (real) => new Proxy(real, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? async () => undefined : undefined)) });
const shell = rama({
  app: { appId: 'kimos-trading', instanceId: 'kimos-trading-abc123', teamId: 't1' },
  assetUrl: (p) => `https://kimos.example/api/apps/kimos-trading/asset/${p}`,
  notify: noop,
  saveData: async (d) => { guardados.push(JSON.stringify(d)); },
  loadData: async () => null,
  items: rama({ list: async () => [], get: async () => null, set: async () => {}, save: async () => {} }),
  documents: rama({ list: async () => [] }),
  brands: rama({ list: async () => ({ brands: [], currentId: '' }) }),
  agent: rama({ register: noop, unregister: noop }),
  window: rama({ setTitle: noop, close: noop }),
  config: rama({ get: async () => ({}), onLoad: noop }),
});

const mod = await import(new URL('../dist/index.js', import.meta.url).href);
const { Component } = mod.default(shell);
const root = createRoot(document.getElementById('r'));
await act(async () => { root.render(React.createElement(Component)); });
await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

const fallos = [];
const check = (label, cond) => { console.log((cond ? '  ok    ' : '  FAIL  ') + label); if (!cond) fallos.push(label); };
const txt = () => document.body.textContent;
const pon = (input, valor) => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  const tracker = input._valueTracker;
  if (tracker) tracker.setValue('');
  setter.call(input, valor);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
};

check('la app monta con contenido', txt().length > 500);
check('la versión en pantalla es 1.1.0', txt().includes('v1.1.0'));

// La app abre con la advertencia de riesgo: hay que aceptarla para entrar.
const entrar = [...document.querySelectorAll('button')].find((b) => /entrar a la cabina/i.test(b.textContent));
check('la app abre con la advertencia de riesgo', !!entrar);
await act(async () => { entrar.click(); });
await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

// Abrir la pestaña Puente
const tabs = [...document.querySelectorAll('button')].filter((b) => /Puente/.test(b.textContent));
check('existe la pestaña Puente', tabs.length > 0);
await act(async () => { tabs[0].click(); });

check('la tarjeta de credenciales aparece', txt().includes('Credenciales de Binance'));
check('dice que no se guardan', /no se guardan/i.test(txt()));
check('ofrece Ed25519 como recomendada', txt().includes('Ed25519'));
check('marca HMAC como obsoleta', /HMAC — obsoleta|obsoleta seg/i.test(txt()));
check('el .env se muestra con marcadores', txt().includes('PEGA-AQUI-LA-API-KEY'));

// Escribir una API key y ver que el .env la toma
const campos = [...document.querySelectorAll('input')];
const campoKey = campos.find((i) => (i.closest('label')?.textContent || '').includes('API Key'));
check('hay un campo para la API Key', !!campoKey);
await act(async () => { pon(campoKey, 'CLAVE-DE-PRUEBA-123'); });
const pre = [...document.querySelectorAll('pre')].map((n) => n.textContent).join('\n');
check('el .env toma la API Key escrita', pre.includes('BINANCE_API_KEY=CLAVE-DE-PRUEBA-123'));
check('el .env apunta a la clave privada del VPS', pre.includes('BINANCE_PRIVATE_KEY_PATH=/etc/geminis/ed25519.pem'));
check('el .env lleva recvWindow dentro del máximo', /BINANCE_RECV_WINDOW=(\d+)/.test(pre) && Number(/BINANCE_RECV_WINDOW=(\d+)/.exec(pre)[1]) <= 60000);

// recvWindow por encima del máximo del contrato se recorta
const campoRecv = campos.find((i) => (i.closest('label')?.textContent || '').includes('recvWindow'));
await act(async () => { pon(campoRecv, '999999'); });
const pre2 = [...document.querySelectorAll('pre')].map((n) => n.textContent).join('\n');
check('un recvWindow gigante se recorta a 60000', pre2.includes('BINANCE_RECV_WINDOW=60000'));

// Con HMAC aparece el campo de secreto, y es de tipo password
const selects = [...document.querySelectorAll('select')];
const selTipo = selects.find((s) => (s.closest('label')?.textContent || '').includes('Tipo de clave'));
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set;
  setter.call(selTipo, 'hmac');
  selTipo.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
});
const secreto = [...document.querySelectorAll('input')].find((i) => (i.closest('label')?.textContent || '').includes('Secret Key'));
check('con HMAC aparece el campo Secret Key', !!secreto);
check('el secreto se pinta oculto', secreto && secreto.type === 'password');
await act(async () => { pon(secreto, 'SECRETO-SUPER-SENSIBLE'); });

// Lo esencial: nada de eso se guarda
await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
const todo = guardados.join('\n');
check('el secreto NUNCA llega a saveData', !todo.includes('SECRETO-SUPER-SENSIBLE'));
check('la API Key NUNCA llega a saveData', !todo.includes('CLAVE-DE-PRUEBA-123'));
check('tampoco queda en localStorage', !String(dom.window.localStorage.getItem('kimos-trading') || '').includes('SECRETO'));

// Y al salir de la pestaña, se borra
const otra = [...document.querySelectorAll('button')].find((b) => /Panel/.test(b.textContent));
await act(async () => { otra.click(); });
await act(async () => { tabs[0].click(); });
const pre3 = [...document.querySelectorAll('pre')].map((n) => n.textContent).join('\n');
check('al volver a la pestaña, las credenciales ya no están', !pre3.includes('CLAVE-DE-PRUEBA-123') && pre3.includes('PEGA-AQUI-LA-API-KEY'));

console.log();
if (fallos.length) { console.log(`${fallos.length} FAIL`); process.exit(1); }
console.log('todo ok');
// La app deja temporizadores vivos (latido, publicación con retardo): sin esto
// el proceso se queda esperándolos y la prueba nunca «termina».
process.exit(0);
