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
 *   node tools/build.mjs          # desde apps/cotizaciones/
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
 * Cotizaciones v${version} — app oficial de KIMOS.
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
    // (test/test-app.mjs). El host solo usa Component y unmount; esto le
    // permite a las pruebas ejercitar el modelo y las acciones sin montar un
    // navegador, que es la única forma de que el motor de cálculo y la fusión
    // multiusuario tengan pruebas de verdad.
    __test: {
      load, refresh, flushPending, getModel, setModel,
      num, computeTotals, nextNumber, validUntilOf, effectiveStatus, cloneDoc,
      normalizeQuote, normalizeRules, mergeDoc, mergeLines, pruneTombs,
      docById, catalogById, mailById, quotesOf, templatesOf, rulesOf, issuerOf,
      visibleDocs, pipelineSummary,
      actSetTab, actOpen, actCloseEditor, actSetSearch, actSetFilterStatus, actSetSort,
      actNewQuote, actDuplicate, actSaveAsTemplate, actPatchDoc, actPatchClient,
      actSetStatus, actRenameDoc, actRemoveDoc,
      actAddLine, actUpdateLine, actRemoveLine, actMoveLine, actDuplicateLine,
      actUpsertCatalogItem, actRemoveCatalogItem, actAddCatalogToQuote, actSaveLineToCatalog,
      actPatchIssuer, actPatchRules,
      loadExternalCatalog, loadCustomers, productByKey,
      actAddProductToQuote, actRefreshLinePrice, actImportClient,
      precioParaCotizar, precioSeleccion, seleccionResuelta, detalleSeleccion,
      grupoVisible, fromProductsItem, fromRawPL, fromPublicPL, plEngine,
      bloquesDe, bloquesPorDefecto, normalizeBlock, contextoDe, BLOCK_TYPES,
      actSetEditorView, actSetBlocks, actAddBlock, actUpdateBlock, actRemoveBlock,
      actMoveBlock, actResetBlocks,
      actSetDefaultTemplate, defaultTemplate, actNewRevision, serieDe, numeroRevision,
      actExportPdf, actPublishQuote, printCss, nombreArchivo, PAPER_SIZES,
      aplicarVars, resolverCorreo, cuerpoHtml, mailStatus, MAIL_VARS,
      actUpsertMailTemplate, actRemoveMailTemplate, actSetDefaultMailTemplate,
      defaultMailTemplate, actPrepareMail, actSendMail, plantillaCorreoEjemplo,
    },
  };
}
`);

const out = parts.join('');
writeFileSync(join(APP, 'dist', 'index.js'), out, 'utf8');
console.log(`✔ dist/index.js — v${version}, ${files.length} fuentes, ${(out.length / 1024).toFixed(1)} KB`);
console.log('  ' + files.join('\n  '));
