#!/usr/bin/env python3
"""Genera dist/index.js para la app instalable "Triatlón Antofagasta" (v2).

Kiosco multi-pantalla (home / inscripción / info) con datos embebidos. El
bundle cumple AppShellV1: monta el HTML en un <iframe srcDoc> y registra la app
en el AgentBridge (shell.agent) para control por un agente autorizado.

Las imágenes (fotos/, banderas/) se sirven por ruta relativa resueltas contra un
`<base>` que apunta a los assets en kimos-packages (GitHub raw). Los datasets
(participantes, rutas) ya vienen embebidos en el HTML, así que no hay fetch.

Reejecuta tras editar el HTML fuente:  python3 build.py
"""
from __future__ import annotations

import pathlib

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "src"
DIST = HERE / "dist"

# Base de assets: GitHub raw del propio repo (rama main, donde despliega el
# backend). Resuelve las rutas relativas `fotos/...` y `banderas/...`.
ASSETS_BASE = "https://raw.githubusercontent.com/ZagrebDev/kimos-packages/main/apps/triatlon-antofagasta/assets/"


def build_html() -> str:
    """Tótem + <base> de assets + protocolo KIMOS, listo para el iframe."""
    totem = (SRC / "totem.html").read_text(encoding="utf-8")
    protocol = (SRC / "protocol.html").read_text(encoding="utf-8")

    base_tag = f'<base href="{ASSETS_BASE}">'
    if "<head>" in totem:
        totem = totem.replace("<head>", "<head>\n    " + base_tag, 1)
    else:
        totem = base_tag + totem

    if "</body>" not in totem:
        raise SystemExit("totem.html no tiene </body>")
    return totem.replace("</body>", protocol + "\n</body>", 1)


def js_template_escape(s: str) -> str:
    """Escapa una cadena para incrustarla en un template literal de JS."""
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


INDEX_TEMPLATE = """\
/**
 * Triatlón Antofagasta v2 — app instalable de Kimos (contrato AppShellV1).
 *
 * GENERADO por build.py — no editar a mano.
 * Fuente: src/totem.html + src/protocol.html (+ assets/ vía <base>).
 *
 * Kiosco del Americas Triathlon Championships Antofagasta 2026: inscripción
 * (categoría → atleta → confirmar → pago/validación → recibo), info (atletas,
 * guía, mapa, calendario) y 3 idiomas. Controlable por agente autorizado.
 */
const TOTEM_HTML = `__HTML__`;

const APP_ID = 'triatlon-antofagasta';
const APP_LABEL = 'Triatlón Antofagasta';
const APP_DESC =
  'Kiosco del Americas Triathlon Championships Antofagasta 2026: inscripción de ' +
  'atletas por categoría (atletas nacionales se validan sin costo; extranjeros pagan), ' +
  'información del evento y atletas. Controlable por un agente autorizado.';

const TOOLS = [
  { name: 'OPEN_REGISTER', description: 'Abre la pantalla de inscripción (paso 1: categorías).', inputSchema: { type: 'object', properties: {} } },
  { name: 'OPEN_INFO', description: 'Abre la pantalla de información en una pestaña.', inputSchema: { type: 'object', properties: { tab: { type: 'string', enum: ['athletes', 'guide', 'map', 'schedule'] } } } },
  { name: 'RETURN_HOME', description: 'Vuelve a la pantalla de inicio.', inputSchema: { type: 'object', properties: {} } },
  { name: 'CHANGE_LANGUAGE', description: 'Cambia el idioma del kiosco.', inputSchema: { type: 'object', properties: { lang: { type: 'string', enum: ['es', 'en', 'pt'] } }, required: ['lang'] } },
  { name: 'SELECT_CATEGORY', description: 'Selecciona una categoría de la inscripción por nombre y avanza a elegir atleta.', inputSchema: { type: 'object', properties: { categoria: { type: 'string' } }, required: ['categoria'] } },
  { name: 'SEARCH_ATHLETE', description: 'Filtra la lista de atletas de la categoría por texto.', inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
  { name: 'SELECT_ATHLETE', description: 'Selecciona un atleta por nombre (o país) y avanza a confirmar.', inputSchema: { type: 'object', properties: { nombre: { type: 'string' }, pais: { type: 'string' } } } },
  { name: 'CONFIRM', description: 'Confirma la inscripción del atleta (nacional: valida sin costo; extranjero: pasa a pago).', inputSchema: { type: 'object', properties: {} } },
  { name: 'PAY', description: 'Simula el pago con tarjeta en el POS (para atletas extranjeros).', inputSchema: { type: 'object', properties: {} } },
  { name: 'FINISH', description: 'Finaliza la inscripción y reinicia el kiosco.', inputSchema: { type: 'object', properties: {} } },
];

export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }

  let frameWindow = null;
  let lastState = { screen: 'home', idioma: 'es', categoria: null, atleta: null, codigo: null, categorias: [] };
  let seq = 0;
  const pending = new Map();
  let unregisterAgent = null;

  function onMessage(e) {
    const d = e && e.data;
    if (!d || d.__kimosTotem !== true) return;
    if (d.state) lastState = d.state;
    if (d.type === 'CMD_RESULT' && d.id != null && pending.has(d.id)) {
      const resolve = pending.get(d.id);
      pending.delete(d.id);
      resolve({ success: !!d.ok, message: d.message });
    }
  }
  window.addEventListener('message', onMessage);

  function sendCmd(cmd, args) {
    if (!frameWindow) return Promise.resolve({ success: false, error: 'El kiosco aún no termina de cargar.' });
    const id = 'cmd-' + ++seq;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      try { frameWindow.postMessage({ __kimosCmd: true, id: id, cmd: cmd, args: args || {} }, '*'); }
      catch (err) { pending.delete(id); resolve({ success: false, error: String(err) }); return; }
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); resolve({ success: false, error: 'Tiempo de espera agotado esperando al kiosco.' }); }
      }, 8000);
    });
  }

  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: APP_LABEL,
      description: APP_DESC,
      tools: TOOLS,
      getSnapshot: () => ({
        pantalla: lastState.screen,
        idioma: lastState.idioma,
        categoria: lastState.categoria,
        atleta: lastState.atleta,
        codigo: lastState.codigo,
        categorias: lastState.categorias,
        instrucciones: 'Flujo de inscripción: OPEN_REGISTER → SELECT_CATEGORY { categoria } → ' +
          'SELECT_ATHLETE { nombre } → CONFIRM → (PAY si el atleta no es nacional). ' +
          'Informa siempre al usuario el resultado (categoría, atleta, código de recibo).',
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        switch (type) {
          case 'OPEN_REGISTER': return sendCmd('OPEN_REGISTER', {});
          case 'OPEN_INFO': return sendCmd('OPEN_INFO', { tab: p.tab });
          case 'RETURN_HOME': return sendCmd('RETURN_HOME', {});
          case 'CHANGE_LANGUAGE': return sendCmd('CHANGE_LANGUAGE', { lang: p.lang });
          case 'SELECT_CATEGORY': return sendCmd('SELECT_CATEGORY', { categoria: p.categoria });
          case 'SEARCH_ATHLETE': return sendCmd('SEARCH_ATHLETE', { texto: p.texto });
          case 'SELECT_ATHLETE': return sendCmd('SELECT_ATHLETE', { nombre: p.nombre, pais: p.pais });
          case 'CONFIRM': return sendCmd('CONFIRM', {});
          case 'PAY': return sendCmd('PAY', {});
          case 'FINISH': return sendCmd('FINISH', {});
          default: return { success: false, error: 'Acción no soportada: ' + type };
        }
      },
    });
  } else {
    console.warn('[triatlon-antofagasta] shell.agent no disponible: la app no será controlable por agente.');
  }

  function Component() {
    return React.createElement('iframe', {
      title: APP_LABEL,
      srcDoc: TOTEM_HTML,
      sandbox: 'allow-scripts allow-forms allow-modals allow-popups',
      style: { width: '100%', height: '100%', border: '0', display: 'block', background: '#fff' },
      ref: (el) => {
        if (el) {
          frameWindow = el.contentWindow;
          el.addEventListener('load', () => { frameWindow = el.contentWindow; });
        }
      },
    });
  }

  return {
    Component,
    unmount() {
      window.removeEventListener('message', onMessage);
      pending.clear();
      if (typeof unregisterAgent === 'function') { try { unregisterAgent(); } catch (e) { /* noop */ } }
    },
  };
}
"""


def main() -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    html = build_html()
    out = INDEX_TEMPLATE.replace("__HTML__", js_template_escape(html))
    (DIST / "index.js").write_text(out, encoding="utf-8")
    print(f"wrote {DIST / 'index.js'} ({len(out)} bytes, html {len(html)} bytes)")


if __name__ == "__main__":
    main()
