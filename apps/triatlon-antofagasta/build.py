#!/usr/bin/env python3
"""Genera dist/index.js para la app instalable "Triatlón Antofagasta".

El bundle cumple el contrato AppShellV1 del front v2 (ver
kimos-enterprice/frontend/src/v2/app-shell/contract.ts):

    export default function mount(shell) -> { Component, unmount? }

`Component` renderiza el tótem (src/totem.html + src/protocol.html) dentro de
un <iframe srcDoc> en sandbox, y el `mount` registra la app en el AgentBridge
(shell.agent) para que un agente autorizado pueda controlarla por postMessage.

No hay paso de compilación con dependencias: kimos-packages sirve los archivos
crudos vía raw.githubusercontent, así que el bundle es JS plano que usa
`globalThis.React` (expuesto por el front en main.tsx). Reejecuta este script
tras editar el HTML fuente:  python3 build.py
"""
from __future__ import annotations

import pathlib

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "src"
DIST = HERE / "dist"


def build_html() -> str:
    """Tótem + protocolo KIMOS, inyectado antes de </body>."""
    totem = (SRC / "totem.html").read_text(encoding="utf-8")
    protocol = (SRC / "protocol.html").read_text(encoding="utf-8")
    if "</body>" not in totem:
        raise SystemExit("totem.html no tiene </body>")
    return totem.replace("</body>", protocol + "\n</body>", 1)


def js_template_escape(s: str) -> str:
    """Escapa una cadena para incrustarla en un template literal de JS."""
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


INDEX_TEMPLATE = """\
/**
 * Triatlón Antofagasta — app instalable de Kimos (contrato AppShellV1, Fase 4).
 *
 * GENERADO por build.py — no editar a mano. Fuente: src/totem.html + src/protocol.html
 *
 * Renderiza un tótem interactivo de retiro de KIT deportivo dentro de un
 * <iframe srcDoc> en sandbox y lo expone al AgentBridge para que un agente
 * autorizado lo controle (ingresar RUT, validar, inscribir, pagar, reiniciar).
 */
const TOTEM_HTML = `__HTML__`;

const APP_ID = 'triatlon-antofagasta';
const APP_LABEL = 'Triatlón Antofagasta';
const APP_DESC =
  'Tótem interactivo de retiro de KIT deportivo del Triatlón de Antofagasta: ' +
  'ingreso de RUT, validación de competidor (federado / no federado / no registrado), ' +
  'inscripción y pago de inscripción.';

const TOOLS = [
  {
    name: 'SET_RUT',
    description: 'Ingresa el RUT del competidor en el teclado del tótem (sin validar todavía).',
    inputSchema: {
      type: 'object',
      properties: {
        rut: { type: 'string', description: 'RUT con o sin formato, ej. "13.036.971-8" o "130369718".' },
      },
      required: ['rut'],
    },
  },
  {
    name: 'VALIDATE_RUT',
    description: 'Valida el RUT ingresado y avanza a la pantalla del competidor (federado, no federado o no registrado).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'INSCRIBIR',
    description: 'Confirma la inscripción de un competidor federado validado (sin costo).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'PAGAR',
    description: 'Confirma el pago de $15.000 de inscripción de un competidor no federado validado.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'RESET',
    description: 'Reinicia el tótem a la pantalla inicial de ingreso de RUT.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React para apps instalables.');
  }

  let frameWindow = null;
  let lastState = { screen: 'screen-1', rutRaw: '', rut: '', competidor: null };
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
    if (!frameWindow) {
      return Promise.resolve({ success: false, error: 'El tótem aún no termina de cargar. Intenta nuevamente.' });
    }
    const id = 'cmd-' + ++seq;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      try {
        frameWindow.postMessage({ __kimosCmd: true, id: id, cmd: cmd, args: args || {} }, '*');
      } catch (err) {
        pending.delete(id);
        resolve({ success: false, error: String(err) });
        return;
      }
      // Salvaguarda: si el tótem no responde, no dejamos colgada la acción.
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ success: false, error: 'Tiempo de espera agotado esperando al tótem.' });
        }
      }, 4000);
    });
  }

  // ── Registro en el AgentBridge (control por agente autorizado) ──────────
  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: APP_LABEL,
      description: APP_DESC,
      tools: TOOLS,
      getSnapshot: () => ({
        pantalla: lastState.screen,
        rut: lastState.rut,
        competidor: lastState.competidor,
        ayuda: 'Flujo: SET_RUT → VALIDATE_RUT → (INSCRIBIR si es federado | PAGAR si no lo es). RESET vuelve al inicio.',
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const payload = (action && action.payload) || {};
        switch (type) {
          case 'SET_RUT':
            return sendCmd('SET_RUT', { rut: payload.rut });
          case 'VALIDATE_RUT':
            return sendCmd('VALIDATE_RUT', {});
          case 'INSCRIBIR':
            return sendCmd('INSCRIBIR', {});
          case 'PAGAR':
            return sendCmd('PAGAR', {});
          case 'RESET':
          case 'GO_HOME':
            return sendCmd('RESET', {});
          default:
            return { success: false, error: 'Acción no soportada: ' + type };
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
      sandbox: 'allow-scripts allow-forms allow-modals',
      style: { width: '100%', height: '100%', border: '0', display: 'block', background: '#fff' },
      ref: (el) => {
        if (el) {
          // contentWindow ya existe al montar; lo refrescamos también en load.
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
      if (typeof unregisterAgent === 'function') {
        try { unregisterAgent(); } catch (e) { /* noop */ }
      }
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
