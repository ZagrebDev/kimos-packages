#!/usr/bin/env node
/**
 * build.mjs — compila `src/*.js` en el bundle único `dist/index.js`.
 *
 * Por qué existe: el host sirve `dist/index.js` tal cual (no hay paso de build
 * en KIMOS), así que la app tiene que viajar en UN archivo. Escribirlo a mano
 * sería inmanejable para una app de este tamaño, así que las fuentes viven
 * separadas por responsabilidad en `src/` y este script las concatena dentro
 * del closure de `mount(shell)` en orden alfabético de nombre de archivo.
 *
 * Los fragmentos de `src/` NO son módulos ESM: no tienen import/export y se
 * apoyan en el preámbulo que este script emite (React, h, hooks, APP_VERSION)
 * y en lo que declaran los fragmentos anteriores. El prefijo numérico fija ese
 * orden.
 *
 * La versión se toma de `manifest.json` y se inyecta como `APP_VERSION`, así
 * que nunca queda desalineada con la fuente de verdad de la app (APP-SPEC §7.a
 * exige además subirla en el catálogo raíz y en el README).
 *
 * Uso:
 *   node tools/build.mjs          # desde apps/marcas/
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(APP, 'manifest.json'), 'utf8'));
const version = String(manifest.version || '0.0.0');

const files = readdirSync(join(APP, 'src'))
  .filter((f) => f.endsWith('.js'))
  .sort();

if (!files.length) {
  console.error('✖ src/ no tiene fuentes que compilar.');
  process.exit(1);
}

const banner = `/**
 * Marcas v${version} — app oficial de KIMOS.
 *
 * ARCHIVO GENERADO por tools/build.mjs a partir de src/. No editar a mano:
 * los cambios van en src/*.js y se recompila con \`node tools/build.mjs\`.
 *
 * Contrato AppShell v1 (kimos-packages/APP-SPEC.md):
 *   - ESM único que exporta \`default mount(shell) -> { Component, unmount }\`.
 *   - Usa \`globalThis.React\` (nunca empaqueta su propia copia).
 *   - Sin JSX: todo con \`React.createElement\`.
 *   - Estado dentro del closure de mount(): una instancia = un cotizador.
 *   - Nunca \`innerHTML\`/\`dangerouslySetInnerHTML\`: el texto que escribe el
 *     usuario (o que llega del catálogo de otra app) se pinta siempre como
 *     elementos React, también en la ventana de impresión.
 */
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef, useCallback, Fragment } = React;

  // Versión visible en pantalla: al probar, confirma qué build tomó el host.
  // La inyecta tools/build.mjs desde manifest.json (APP-SPEC §7.a).
  const APP_VERSION = '${version}';
`;

const parts = [banner];
for (const f of files) {
  const body = readFileSync(join(APP, 'src', f), 'utf8').replace(/\s+$/, '');
  parts.push(`
// ══════════════════════════════════════════════════════════════════════
// src/${f}
// ══════════════════════════════════════════════════════════════════════
${body}
`);
}
parts.push(`
  return {
    Component: App,
    unmount() { teardown(); },
    // Ventana al interior del closure para el banco de pruebas
    // (test/test-app.mjs). El host solo usa Component y unmount.
    __test: {
      cargar, getModel, setModel, teardown, suscribir,
      normalizeBrand, normalizeColor, normalizeLogo, normalizeFont,
      normalizeEcosystem, normalizePrincipio, paraGuardar,
      colorPorRol, colorPorClave, logoParaFondo, marcaPorId, seleccionada,
      normalizeHex, esHexValido, hexToRgb, hexToHslToken, textoLegible, contraste, slug,
      puedeEditar, registroNoDisponible, abrirBorrador, editarBorrador,
      COLOR_ROLES, LOGO_BACKGROUNDS, TYPE_USAGES, SECCIONES,
      actSeleccionar, actNuevaMarca, actGuardar, actDescartar, actBorrar,
      actActivar, actDuplicar, actSetCampo,
      actSetColor, actAddColor, actRemoveColor, actMoveColor,
      actSetLogo, actAddLogo, actRemoveLogo, actSubirLogo,
      actSetFont, actAddFont, actRemoveFont,
      actSetEco, actAddEco, actRemoveEco,
      actSetPrincipio, actAddPrincipio, actRemovePrincipio,
      actSetTab, actSetSeccion, actToggleSeccionHoja, actImprimirHoja,
      avisosDe, resumenDe, hojaContexto, marcaEnBlanco, printCss, nombreArchivo,
      registrarAgente, agentSnapshot, agentDispatch, AGENT_TOOLS, resolverMarca,
      // Los componentes, para que el banco de pruebas los renderice: viven
      // detrás de estado de interacción y si no se pintarían por primera vez
      // en producción.
      dialogos: {
        Hoja, Editor, Cartera, Barra, HojaOpciones, Modal,
        EdIdentidad, EdPaleta, EdLogos, EdTipografias, EdEcosistemas, EdPrincipios,
      },
    },
  };
}
`);

const out = parts.join('');
writeFileSync(join(APP, 'dist', 'index.js'), out, 'utf8');
console.log(`✔ dist/index.js — v${version}, ${files.length} fuentes, ${(out.length / 1024).toFixed(1)} KB`);
console.log('  ' + files.join('\n  '));
