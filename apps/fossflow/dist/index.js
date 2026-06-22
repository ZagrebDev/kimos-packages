/**
 * FossFLOW — app instalable de Kimos: creador de diagramas de flujo isométricos.
 *
 * Bundle ESM autocontenido. Usa React desde globalThis (lo expone el shell).
 * Sin JSX, sin paso de build en el host, sin WebGL/Three.js — proyección
 * isométrica 2D en SVG puro.
 *
 * Contrato: export default function mount(shell): { Component, unmount? }
 *
 * ICONOS NATIVOS: el set de iconos (Lucide, licencia ISC) va EMBEBIDO en este
 * bundle (BUILTIN_ICONS), generado desde apps/fossflow/icons/*.svg. No hay
 * dependencia de red ni de URLs externas en runtime. El usuario igualmente puede
 * importar un icono propio por URL/data-URI.
 *
 * Modelo FossFLOW:
 *   model = {
 *     title, nodes:[{id,label,type,x,y,z,color,icon:{kind,value}}],
 *     connections:[{id,from,to,label,color,dashed,bidir}]
 *   }
 *   icon.kind ∈ 'builtin' (clave de BUILTIN_ICONS) | 'emoji' | 'url'
 */

// ── Iconos nativos embebidos (Lucide ISC — https://lucide.dev) ───────────────
// Cada valor es el cuerpo interno del SVG (stroke=currentColor heredado).
const BUILTIN_ICONS = {
  "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />",
  "antenna": "<path d=\"M2 12 7 2\" /><path d=\"m7 12 5-10\" /><path d=\"m12 12 5-10\" /><path d=\"m17 12 5-10\" /><path d=\"M4.5 7h15\" /><path d=\"M12 16v6\" />",
  "archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\" /><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\" /><path d=\"M10 12h4\" />",
  "ban": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M4.929 4.929 19.07 19.071\" />",
  "banknote": "<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\" /><circle cx=\"12\" cy=\"12\" r=\"2\" /><path d=\"M6 12h.01M18 12h.01\" />",
  "battery": "<path d=\"M 22 14 L 22 10\" /><rect x=\"2\" y=\"6\" width=\"16\" height=\"12\" rx=\"2\" />",
  "bell": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\" /><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\" />",
  "bookmark": "<path d=\"M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z\" />",
  "bot": "<path d=\"M12 8V4H8\" /><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\" /><path d=\"M2 14h2\" /><path d=\"M20 14h2\" /><path d=\"M15 13v2\" /><path d=\"M9 13v2\" />",
  "box": "<path d=\"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z\" /><path d=\"m3.3 7 8.7 5 8.7-5\" /><path d=\"M12 22V12\" />",
  "brain": "<path d=\"M12 18V5\" /><path d=\"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4\" /><path d=\"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5\" /><path d=\"M17.997 5.125a4 4 0 0 1 2.526 5.77\" /><path d=\"M18 18a4 4 0 0 0 2-7.464\" /><path d=\"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517\" /><path d=\"M6 18a4 4 0 0 1-2-7.464\" /><path d=\"M6.003 5.125a4 4 0 0 0-2.526 5.77\" />",
  "briefcase": "<path d=\"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\" /><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\" />",
  "bug": "<path d=\"M12 20v-9\" /><path d=\"M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z\" /><path d=\"M14.12 3.88 16 2\" /><path d=\"M21 21a4 4 0 0 0-3.81-4\" /><path d=\"M21 5a4 4 0 0 1-3.55 3.97\" /><path d=\"M22 13h-4\" /><path d=\"M3 21a4 4 0 0 1 3.81-4\" /><path d=\"M3 5a4 4 0 0 0 3.55 3.97\" /><path d=\"M6 13H2\" /><path d=\"m8 2 1.88 1.88\" /><path d=\"M9 7.13V6a3 3 0 1 1 6 0v1.13\" />",
  "building": "<path d=\"M12 10h.01\" /><path d=\"M12 14h.01\" /><path d=\"M12 6h.01\" /><path d=\"M16 10h.01\" /><path d=\"M16 14h.01\" /><path d=\"M16 6h.01\" /><path d=\"M8 10h.01\" /><path d=\"M8 14h.01\" /><path d=\"M8 6h.01\" /><path d=\"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3\" /><rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\" />",
  "building-2": "<path d=\"M10 12h4\" /><path d=\"M10 8h4\" /><path d=\"M14 21v-3a2 2 0 0 0-4 0v3\" /><path d=\"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2\" /><path d=\"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16\" />",
  "cable": "<path d=\"M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z\" /><path d=\"M17 21v-2\" /><path d=\"M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10\" /><path d=\"M21 21v-2\" /><path d=\"M3 5V3\" /><path d=\"M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z\" /><path d=\"M7 5V3\" />",
  "car": "<path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\" /><circle cx=\"7\" cy=\"17\" r=\"2\" /><path d=\"M9 17h6\" /><circle cx=\"17\" cy=\"17\" r=\"2\" />",
  "chart-bar": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"M7 16h8\" /><path d=\"M7 11h12\" /><path d=\"M7 6h3\" />",
  "chart-line": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"m19 9-5 5-4-4-3 3\" />",
  "chart-pie": "<path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" />",
  "check": "<path d=\"M20 6 9 17l-5-5\" />",
  "check-check": "<path d=\"M18 6 7 17l-5-5\" /><path d=\"m22 10-7.5 7.5L13 16\" />",
  "circle": "<circle cx=\"12\" cy=\"12\" r=\"10\" />",
  "circle-check": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m9 12 2 2 4-4\" />",
  "circle-x": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m15 9-6 6\" /><path d=\"m9 9 6 6\" />",
  "clipboard-list": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /><path d=\"M12 11h4\" /><path d=\"M12 16h4\" /><path d=\"M8 11h.01\" /><path d=\"M8 16h.01\" />",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 6v6l4 2\" />",
  "cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />",
  "code": "<path d=\"m16 18 6-6-6-6\" /><path d=\"m8 6-6 6 6 6\" />",
  "cog": "<path d=\"M11 10.27 7 3.34\" /><path d=\"m11 13.73-4 6.93\" /><path d=\"M12 22v-2\" /><path d=\"M12 2v2\" /><path d=\"M14 12h8\" /><path d=\"m17 20.66-1-1.73\" /><path d=\"m17 3.34-1 1.73\" /><path d=\"M2 12h2\" /><path d=\"m20.66 17-1.73-1\" /><path d=\"m20.66 7-1.73 1\" /><path d=\"m3.34 17 1.73-1\" /><path d=\"m3.34 7 1.73 1\" /><circle cx=\"12\" cy=\"12\" r=\"2\" /><circle cx=\"12\" cy=\"12\" r=\"8\" />",
  "compass": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\" />",
  "contact": "<path d=\"M16 2v2\" /><path d=\"M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2\" /><path d=\"M8 2v2\" /><circle cx=\"12\" cy=\"11\" r=\"3\" /><rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" />",
  "cpu": "<path d=\"M12 20v2\" /><path d=\"M12 2v2\" /><path d=\"M17 20v2\" /><path d=\"M17 2v2\" /><path d=\"M2 12h2\" /><path d=\"M2 17h2\" /><path d=\"M2 7h2\" /><path d=\"M20 12h2\" /><path d=\"M20 17h2\" /><path d=\"M20 7h2\" /><path d=\"M7 20v2\" /><path d=\"M7 2v2\" /><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" /><rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" rx=\"1\" />",
  "credit-card": "<rect width=\"20\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\" /><line x1=\"2\" x2=\"22\" y1=\"10\" y2=\"10\" />",
  "database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /><path d=\"M3 5V19A9 3 0 0 0 21 19V5\" /><path d=\"M3 12A9 3 0 0 0 21 12\" />",
  "diamond": "<path d=\"M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z\" />",
  "disc": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><circle cx=\"12\" cy=\"12\" r=\"2\" />",
  "dollar-sign": "<line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"22\" /><path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\" />",
  "droplet": "<path d=\"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z\" />",
  "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "eye-off": "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\" /><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\" /><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\" /><path d=\"m2 2 20 20\" />",
  "factory": "<path d=\"M12 16h.01\" /><path d=\"M16 16h.01\" /><path d=\"M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z\" /><path d=\"M8 16h.01\" />",
  "file": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /><path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />",
  "file-text": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /><path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /><path d=\"M10 9H8\" /><path d=\"M16 13H8\" /><path d=\"M16 17H8\" />",
  "files": "<path d=\"M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8\" /><path d=\"M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z\" /><path d=\"M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1\" />",
  "flag": "<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\" />",
  "flame": "<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\" />",
  "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" />",
  "folder-open": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />",
  "fuel": "<path d=\"M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5\" /><path d=\"M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16\" /><path d=\"M2 21h13\" /><path d=\"M3 9h11\" />",
  "git-branch": "<path d=\"M15 6a9 9 0 0 0-9 9V3\" /><circle cx=\"18\" cy=\"6\" r=\"3\" /><circle cx=\"6\" cy=\"18\" r=\"3\" />",
  "git-merge": "<circle cx=\"18\" cy=\"18\" r=\"3\" /><circle cx=\"6\" cy=\"6\" r=\"3\" /><path d=\"M6 21V9a9 9 0 0 0 9 9\" />",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\" /><path d=\"M2 12h20\" />",
  "hard-drive": "<path d=\"M10 16h.01\" /><path d=\"M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" /><path d=\"M21.946 12.013H2.054\" /><path d=\"M6 16h.01\" />",
  "headphones": "<path d=\"M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3\" />",
  "hexagon": "<path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" />",
  "hourglass": "<path d=\"M5 22h14\" /><path d=\"M5 2h14\" /><path d=\"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22\" /><path d=\"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2\" />",
  "house": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" /><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />",
  "inbox": "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\" /><path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" />",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" />",
  "key": "<path d=\"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4\" /><path d=\"m21 2-9.6 9.6\" /><circle cx=\"7.5\" cy=\"15.5\" r=\"5.5\" />",
  "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\" /><circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "keyboard": "<path d=\"M10 8h.01\" /><path d=\"M12 12h.01\" /><path d=\"M14 8h.01\" /><path d=\"M16 12h.01\" /><path d=\"M18 8h.01\" /><path d=\"M6 8h.01\" /><path d=\"M7 16h10\" /><path d=\"M8 12h.01\" /><rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\" />",
  "laptop": "<path d=\"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z\" /><path d=\"M20.054 15.987H3.946\" />",
  "layers": "<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\" /><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\" /><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\" />",
  "lightbulb": "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\" /><path d=\"M9 18h6\" /><path d=\"M10 22h4\" />",
  "list": "<path d=\"M3 5h.01\" /><path d=\"M3 12h.01\" /><path d=\"M3 19h.01\" /><path d=\"M8 5h13\" /><path d=\"M8 12h13\" /><path d=\"M8 19h13\" />",
  "loader-circle": "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\" />",
  "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />",
  "lock-open": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /><path d=\"M7 11V7a5 5 0 0 1 9.9-1\" />",
  "mail": "<path d=\"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7\" /><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\" />",
  "map": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\" /><path d=\"M15 5.764v15\" /><path d=\"M9 3.236v15\" />",
  "map-pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\" /><circle cx=\"12\" cy=\"10\" r=\"3\" />",
  "memory-stick": "<path d=\"M12 12v-2\" /><path d=\"M12 18v-2\" /><path d=\"M16 12v-2\" /><path d=\"M16 18v-2\" /><path d=\"M2 11h1.5\" /><path d=\"M20 18v-2\" /><path d=\"M20.5 11H22\" /><path d=\"M4 18v-2\" /><path d=\"M8 12v-2\" /><path d=\"M8 18v-2\" /><rect x=\"2\" y=\"6\" width=\"20\" height=\"10\" rx=\"2\" />",
  "merge": "<path d=\"m8 6 4-4 4 4\" /><path d=\"M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22\" /><path d=\"m20 22-5-5\" />",
  "message-square": "<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\" />",
  "milestone": "<path d=\"M12 13v8\" /><path d=\"M12 3v3\" /><path d=\"M18.172 6a2 2 0 0 1 1.414.586l2.06 2.06a1.207 1.207 0 0 1 0 1.708l-2.06 2.06a2 2 0 0 1-1.414.586H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z\" />",
  "monitor": "<rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\" /><line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\" /><line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\" />",
  "mouse": "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"7\" /><path d=\"M12 6v4\" />",
  "navigation": "<polygon points=\"3 11 22 2 13 21 11 13 3 11\" />",
  "network": "<rect x=\"16\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /><rect x=\"2\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /><rect x=\"9\" y=\"2\" width=\"6\" height=\"6\" rx=\"1\" /><path d=\"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3\" /><path d=\"M12 12V8\" />",
  "octagon-alert": "<path d=\"M12 16h.01\" /><path d=\"M12 8v4\" /><path d=\"M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z\" />",
  "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\" /><path d=\"M12 22V12\" /><polyline points=\"3.29 7 12 12 20.71 7\" /><path d=\"m7.5 4.27 9 5.15\" />",
  "phone": "<path d=\"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384\" />",
  "plane": "<path d=\"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\" />",
  "play": "<path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\" />",
  "plug": "<path d=\"M12 22v-5\" /><path d=\"M15 8V2\" /><path d=\"M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z\" /><path d=\"M9 8V2\" />",
  "power": "<path d=\"M12 2v10\" /><path d=\"M18.4 6.6a9 9 0 1 1-12.77.04\" />",
  "printer": "<path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\" /><path d=\"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\" /><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" rx=\"1\" />",
  "radio": "<path d=\"M16.247 7.761a6 6 0 0 1 0 8.478\" /><path d=\"M19.075 4.933a10 10 0 0 1 0 14.134\" /><path d=\"M4.925 19.067a10 10 0 0 1 0-14.134\" /><path d=\"M7.753 16.239a6 6 0 0 1 0-8.478\" /><circle cx=\"12\" cy=\"12\" r=\"2\" />",
  "repeat": "<path d=\"m17 2 4 4-4 4\" /><path d=\"M3 11v-1a4 4 0 0 1 4-4h14\" /><path d=\"m7 22-4-4 4-4\" /><path d=\"M21 13v1a4 4 0 0 1-4 4H3\" />",
  "route": "<circle cx=\"6\" cy=\"19\" r=\"3\" /><path d=\"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\" /><circle cx=\"18\" cy=\"5\" r=\"3\" />",
  "router": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" /><path d=\"M6.01 18H6\" /><path d=\"M10.01 18H10\" /><path d=\"M15 10v4\" /><path d=\"M17.84 7.17a4 4 0 0 0-5.66 0\" /><path d=\"M20.66 4.34a8 8 0 0 0-11.31 0\" />",
  "rss": "<path d=\"M4 11a9 9 0 0 1 9 9\" /><path d=\"M4 4a16 16 0 0 1 16 16\" /><circle cx=\"5\" cy=\"19\" r=\"1\" />",
  "satellite-dish": "<path d=\"M4 10a7.31 7.31 0 0 0 10 10Z\" /><path d=\"m9 15 3-3\" /><path d=\"M17 13a6 6 0 0 0-6-6\" /><path d=\"M21 13A10 10 0 0 0 11 3\" />",
  "scan": "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\" /><path d=\"M17 3h2a2 2 0 0 1 2 2v2\" /><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\" /><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\" />",
  "scan-face": "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\" /><path d=\"M17 3h2a2 2 0 0 1 2 2v2\" /><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\" /><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\" /><path d=\"M8 14s1.5 2 4 2 4-2 4-2\" /><path d=\"M9 9h.01\" /><path d=\"M15 9h.01\" />",
  "server": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\" /><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\" /><line x1=\"6\" x2=\"6.01\" y1=\"6\" y2=\"6\" /><line x1=\"6\" x2=\"6.01\" y1=\"18\" y2=\"18\" />",
  "settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "share-2": "<circle cx=\"18\" cy=\"5\" r=\"3\" /><circle cx=\"6\" cy=\"12\" r=\"3\" /><circle cx=\"18\" cy=\"19\" r=\"3\" /><line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\" /><line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\" />",
  "shield": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" />",
  "shield-alert": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"M12 8v4\" /><path d=\"M12 16h.01\" />",
  "shield-check": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"m9 12 2 2 4-4\" />",
  "ship": "<path d=\"M12 10.189V14\" /><path d=\"M12 2v3\" /><path d=\"M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6\" /><path d=\"M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76\" /><path d=\"M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1\" />",
  "shopping-cart": "<circle cx=\"8\" cy=\"21\" r=\"1\" /><circle cx=\"19\" cy=\"21\" r=\"1\" /><path d=\"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12\" />",
  "smartphone": "<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\" /><path d=\"M12 18h.01\" />",
  "split": "<path d=\"M16 3h5v5\" /><path d=\"M8 3H3v5\" /><path d=\"M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3\" /><path d=\"m15 9 6-6\" />",
  "square": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />",
  "star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />",
  "store": "<path d=\"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5\" /><path d=\"M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244\" /><path d=\"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05\" />",
  "table": "<path d=\"M12 3v18\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M3 9h18\" /><path d=\"M3 15h18\" />",
  "tablet": "<rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\" ry=\"2\" /><line x1=\"12\" x2=\"12.01\" y1=\"18\" y2=\"18\" />",
  "tag": "<path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\" /><circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "terminal": "<path d=\"M12 19h8\" /><path d=\"m4 17 6-6-6-6\" />",
  "train-front": "<path d=\"M8 3.1V7a4 4 0 0 0 8 0V3.1\" /><path d=\"m9 15-1-1\" /><path d=\"m15 15 1-1\" /><path d=\"M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z\" /><path d=\"m8 19-2 3\" /><path d=\"m16 19 2 3\" />",
  "triangle": "<path d=\"M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" />",
  "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
  "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /><circle cx=\"12\" cy=\"7\" r=\"4\" />",
  "user-check": "<path d=\"m16 11 2 2 4-4\" /><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><circle cx=\"9\" cy=\"7\" r=\"4\" />",
  "user-cog": "<path d=\"M10 15H6a4 4 0 0 0-4 4v2\" /><path d=\"m14.305 16.53.923-.382\" /><path d=\"m15.228 13.852-.923-.383\" /><path d=\"m16.852 12.228-.383-.923\" /><path d=\"m16.852 17.772-.383.924\" /><path d=\"m19.148 12.228.383-.923\" /><path d=\"m19.53 18.696-.382-.924\" /><path d=\"m20.772 13.852.924-.383\" /><path d=\"m20.772 16.148.924.383\" /><circle cx=\"18\" cy=\"15\" r=\"3\" /><circle cx=\"9\" cy=\"7\" r=\"4\" />",
  "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /><path d=\"M16 3.128a4 4 0 0 1 0 7.744\" /><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" /><circle cx=\"9\" cy=\"7\" r=\"4\" />",
  "warehouse": "<path d=\"M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11\" /><path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z\" /><path d=\"M6 13h12\" /><path d=\"M6 17h12\" />",
  "webcam": "<circle cx=\"12\" cy=\"10\" r=\"8\" /><circle cx=\"12\" cy=\"10\" r=\"3\" /><path d=\"M7 22h10\" /><path d=\"M12 22v-4\" />",
  "wifi": "<path d=\"M12 20h.01\" /><path d=\"M2 8.82a15 15 0 0 1 20 0\" /><path d=\"M5 12.859a10 10 0 0 1 14 0\" /><path d=\"M8.5 16.429a5 5 0 0 1 7 0\" />",
  "workflow": "<rect width=\"8\" height=\"8\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M7 11v4a2 2 0 0 0 2 2h4\" /><rect width=\"8\" height=\"8\" x=\"13\" y=\"13\" rx=\"2\" />",
  "wrench": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\" />",
  "x": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
  "zap": "<path d=\"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z\" />"
};

// Agrupación para el selector (las claves inexistentes se filtran en runtime).
const BUILTIN_CATEGORIES = [
  { name: 'Flujo', items: ['play', 'square', 'circle', 'diamond', 'hexagon', 'triangle', 'flag', 'milestone', 'workflow', 'split', 'merge', 'git-branch', 'git-merge', 'route', 'repeat', 'check', 'check-check', 'circle-check', 'x', 'circle-x', 'triangle-alert', 'octagon-alert', 'info', 'ban', 'clock', 'hourglass', 'loader-circle'] },
  { name: 'Red / Infra', items: ['server', 'database', 'hard-drive', 'cloud', 'network', 'router', 'wifi', 'radio', 'satellite-dish', 'globe', 'cable', 'share-2', 'rss', 'antenna'] },
  { name: 'Dispositivos', items: ['monitor', 'laptop', 'smartphone', 'tablet', 'cpu', 'memory-stick', 'mouse', 'keyboard', 'printer', 'webcam', 'disc'] },
  { name: 'Datos', items: ['chart-bar', 'chart-line', 'chart-pie', 'table', 'file', 'files', 'folder', 'folder-open', 'file-text', 'clipboard-list', 'list', 'layers', 'box', 'package', 'archive', 'inbox'] },
  { name: 'Personas / Negocio', items: ['user', 'users', 'user-check', 'user-cog', 'contact', 'briefcase', 'building', 'building-2', 'factory', 'store', 'shopping-cart', 'credit-card', 'dollar-sign', 'banknote', 'mail', 'phone', 'message-square', 'headphones'] },
  { name: 'Seguridad', items: ['lock', 'lock-open', 'key', 'key-round', 'shield', 'shield-check', 'shield-alert', 'scan', 'scan-face', 'eye', 'eye-off', 'bug'] },
  { name: 'Lugares', items: ['house', 'map', 'map-pin', 'navigation', 'compass', 'warehouse', 'fuel', 'plane', 'ship', 'car', 'train-front'] },
  { name: 'Sistema / Otros', items: ['bell', 'star', 'bookmark', 'tag', 'settings', 'wrench', 'zap', 'flame', 'droplet', 'battery', 'plug', 'power', 'activity', 'terminal', 'code', 'bot', 'brain', 'cog', 'lightbulb'] },
];

// ── Geometría isométrica ─────────────────────────────────────────────────────
const TILE_W = 64, TILE_H = 32;
const HW = TILE_W / 2, HH = TILE_H / 2;
const TILE_Z = 26, SLAB = 5, FOOT = 0.92;
const HWf = HW * FOOT, HHf = HH * FOOT;
const ICON_SIZE = 38, GRID = 14;

// Tipos (color base + icono por defecto, ahora claves builtin).
const TYPES = {
  server:   { label: 'Servidor', icon: 'server', color: '#3b82f6' },
  database: { label: 'Base de datos', icon: 'database', color: '#8b5cf6' },
  cloud:    { label: 'Nube', icon: 'cloud', color: '#06b6d4' },
  service:  { label: 'Servicio', icon: 'cog', color: '#f59e0b' },
  user:     { label: 'Usuario', icon: 'user', color: '#22c55e' },
  process:  { label: 'Proceso', icon: 'zap', color: '#ef4444' },
  decision: { label: 'Decisión', icon: 'split', color: '#eab308' },
  data:     { label: 'Datos', icon: 'chart-bar', color: '#14b8a6' },
  generic:  { label: 'Nodo', icon: 'box', color: '#64748b' },
};
const TYPE_ORDER = ['server', 'database', 'cloud', 'service', 'user', 'process', 'decision', 'data', 'generic'];

// Acceso rápido en la paleta superior (claves builtin).
const QUICK_ICONS = ['server', 'database', 'cloud', 'network', 'monitor', 'laptop', 'user', 'users', 'building', 'package', 'layers', 'shield', 'bot', 'cog', 'mail', 'globe', 'split', 'zap'];

// Catálogo de emojis (alternativa offline, universal).
const EMOJI_CATEGORIES = [
  { name: 'Flujo', items: ['▶️', '⏹️', '🔀', '🔁', '✅', '❌', '⚠️', '❓', '⏳', '🚦', '🏁', '↪️', '↩️', '⤴️', '⤵️', '🔂'] },
  { name: 'Objetos', items: ['🖥️', '💻', '☁️', '🗄️', '🌐', '⚙️', '📡', '🔌', '🧱', '🛡️', '🔒', '🔑', '💾', '🧮', '🤖', '🧠'] },
  { name: 'Personas', items: ['👤', '👥', '🧑‍💻', '👨‍💼', '👩‍💼', '🧑‍🔧', '🧑‍🏭', '👮', '🕵️', '🙋', '🤝', '📞', '✉️', '🏢', '🏭', '🛒'] },
  { name: 'Símbolos', items: ['⭐', '💡', '🔔', '📌', '🧩', '🎯', '🔥', '💧', '⚡', '♻️', '⚖️', '⏱️', '🔋', '📶', '🆗', '📍'] },
];

// ── Color ─────────────────────────────────────────────────────────────────────
function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function hexToRgb(hex) {
  let s = String(hex || '').replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) s = '64748b';
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join(''); }
function shade(hex, pct) { const { r, g, b } = hexToRgb(hex); const t = pct < 0 ? 0 : 255, p = Math.abs(pct); return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p); }
function rgba(hex, a) { const { r, g, b } = hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

// ── Proyección ────────────────────────────────────────────────────────────────
function project(x, y, z) { return { sx: (x - y) * HW, sy: (x + y) * HH - (z || 0) * TILE_Z }; }
function unproject(sx, sy, z) { const yy = sy + (z || 0) * TILE_Z; const a = sx / HW, b = yy / HH; return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) }; }
function genId(p) { return p + '-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4); }

// ── Iconos (resolución de tipo) ───────────────────────────────────────────────
function resolveIconString(v) {
  if (BUILTIN_ICONS[v]) return { kind: 'builtin', value: v };
  if (/^(https?:|data:)/i.test(v)) return { kind: 'url', value: v };
  if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(v)) {          // legacy iconify "mdi:server" → migra por sufijo
    const suf = v.split(':')[1];
    if (BUILTIN_ICONS[suf]) return { kind: 'builtin', value: suf };
    return { kind: 'emoji', value: '📦' };
  }
  return { kind: 'emoji', value: v };
}
function normalizeIcon(raw, fb) {
  if (raw && typeof raw === 'object' && raw.value) {
    if (raw.kind === 'builtin' && BUILTIN_ICONS[raw.value]) return { kind: 'builtin', value: String(raw.value) };
    if (raw.kind === 'url') return { kind: 'url', value: String(raw.value) };
    if (raw.kind === 'emoji') return { kind: 'emoji', value: String(raw.value) };
    return resolveIconString(String(raw.value));
  }
  if (typeof raw === 'string' && raw.trim()) return resolveIconString(raw.trim());
  return resolveIconString(fb || 'box');
}
function iconToString(ic) { return ic && ic.value ? ic.value : ''; }

// ── Normalización del modelo ──────────────────────────────────────────────────
function normalizeModel(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const title = typeof src.title === 'string' && src.title.trim() ? src.title : 'Diagrama de flujo';
  const seen = new Set();
  const nodes = [];
  if (Array.isArray(src.nodes)) {
    for (const n of src.nodes) {
      if (!n || typeof n !== 'object') continue;
      const id = String(n.id || genId('n')).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const type = n.type && TYPES[n.type] ? n.type : 'generic';
      const def = TYPES[type];
      nodes.push({
        id,
        label: typeof n.label === 'string' && n.label ? n.label : def.label,
        type,
        x: Number.isFinite(n.x) ? Math.round(n.x) : 0,
        y: Number.isFinite(n.y) ? Math.round(n.y) : 0,
        z: Number.isFinite(n.z) ? Math.round(n.z) : 0,
        color: typeof n.color === 'string' && n.color ? n.color : def.color,
        icon: normalizeIcon(n.icon, def.icon),
      });
    }
  }
  const valid = new Set(nodes.map((n) => n.id));
  const cseen = new Set();
  const connections = [];
  if (Array.isArray(src.connections)) {
    for (const c of src.connections) {
      if (!c || typeof c !== 'object') continue;
      const from = String(c.from || '').trim(), to = String(c.to || '').trim();
      if (!from || !to || from === to || !valid.has(from) || !valid.has(to)) continue;
      const id = String(c.id || genId('c')).trim();
      if (cseen.has(id)) continue;
      cseen.add(id);
      connections.push({
        id, from, to,
        label: typeof c.label === 'string' ? c.label : '',
        color: typeof c.color === 'string' && c.color ? c.color : '#64748b',
        dashed: !!c.dashed,
        bidir: !!c.bidir,
      });
    }
  }
  return { title, nodes, connections };
}

export default function mount(shell) {
  const R = globalThis.React;
  if (!R || typeof R.createElement !== 'function') return { Component() { return null; } };
  const { useState, useEffect, useRef, useCallback, useMemo } = R;
  const h = R.createElement;

  function notify(level, text) { try { shell.notify({ level, text }); } catch { /* no-op */ } }

  // ── Estado del modelo (cerrado por instancia) ──────────────────────────────
  let model = normalizeModel(null);
  let loaded = false;
  const listeners = new Set();
  let saveTimer = null;

  function emit() { for (const l of listeners) { try { l(model); } catch { /* no-op */ } } }
  function scheduleSave() {
    if (!loaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { shell.saveData({ model }).catch((err) => notify('error', (err && err.message) || 'No se pudo guardar')); }, 600);
  }
  function commit(next) { model = next; emit(); scheduleSave(); }
  function nodeById(id) { return model.nodes.find((n) => n.id === id) || null; }

  function findFreeCell(prefX, prefY) {
    const occ = new Set(model.nodes.map((n) => n.x + ',' + n.y));
    const cx = Number.isFinite(prefX) ? Math.round(prefX) : 0;
    const cy = Number.isFinite(prefY) ? Math.round(prefY) : 0;
    if (!occ.has(cx + ',' + cy)) return { x: cx, y: cy };
    for (let r = 1; r <= GRID; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (!occ.has((cx + dx) + ',' + (cy + dy))) return { x: cx + dx, y: cy + dy };
    }
    return { x: cx, y: cy };
  }

  function addNode(attrs) {
    const a = attrs || {};
    const type = a.type && TYPES[a.type] ? a.type : 'generic';
    const def = TYPES[type];
    let x = Number.isFinite(a.x) ? Math.round(a.x) : null;
    let y = Number.isFinite(a.y) ? Math.round(a.y) : null;
    if (x === null || y === null) { const c = findFreeCell(x, y); x = c.x; y = c.y; }
    const node = {
      id: a.id ? String(a.id) : genId('n'),
      label: typeof a.label === 'string' && a.label ? a.label : def.label,
      type, x, y,
      z: Number.isFinite(a.z) ? Math.round(a.z) : 0,
      color: typeof a.color === 'string' && a.color ? a.color : def.color,
      icon: a.icon !== undefined ? normalizeIcon(a.icon, def.icon) : normalizeIcon(def.icon, def.icon),
    };
    commit({ ...model, nodes: [...model.nodes, node] });
    return node;
  }
  function updateNode(id, patch) {
    const p = patch || {};
    let found = null;
    const nodes = model.nodes.map((n) => {
      if (n.id !== id) return n;
      const type = p.type && TYPES[p.type] ? p.type : n.type;
      found = {
        ...n, type,
        label: typeof p.label === 'string' && p.label ? p.label : n.label,
        x: Number.isFinite(p.x) ? Math.round(p.x) : n.x,
        y: Number.isFinite(p.y) ? Math.round(p.y) : n.y,
        z: Number.isFinite(p.z) ? Math.round(p.z) : n.z,
        color: typeof p.color === 'string' && p.color ? p.color : n.color,
        icon: p.icon !== undefined ? normalizeIcon(p.icon, n.icon && n.icon.value) : n.icon,
      };
      return found;
    });
    if (found) commit({ ...model, nodes });
    return found;
  }
  function duplicateNode(id) {
    const n = nodeById(id);
    if (!n) return null;
    const cell = findFreeCell(n.x + 1, n.y);
    return addNode({ ...n, id: undefined, icon: n.icon, x: cell.x, y: cell.y });
  }
  function deleteNode(id) {
    if (!nodeById(id)) return false;
    commit({ ...model, nodes: model.nodes.filter((n) => n.id !== id), connections: model.connections.filter((c) => c.from !== id && c.to !== id) });
    return true;
  }
  function addConnection(from, to, label) {
    const f = String(from || ''), t = String(to || '');
    if (!nodeById(f) || !nodeById(t)) return { ok: false, message: 'Origen o destino inexistente.' };
    if (f === t) return { ok: false, message: 'No se puede conectar un nodo consigo mismo.' };
    if (model.connections.some((c) => (c.from === f && c.to === t) || (c.from === t && c.to === f))) return { ok: false, message: 'Esa conexión ya existe.' };
    const conn = { id: genId('c'), from: f, to: t, label: typeof label === 'string' ? label : '', color: '#64748b', dashed: false, bidir: false };
    commit({ ...model, connections: [...model.connections, conn] });
    return { ok: true, conn };
  }
  function updateConnection(id, patch) {
    const p = patch || {};
    let found = null;
    const connections = model.connections.map((c) => {
      if (c.id !== id) return c;
      found = {
        ...c,
        label: typeof p.label === 'string' ? p.label : c.label,
        color: typeof p.color === 'string' && p.color ? p.color : c.color,
        dashed: typeof p.dashed === 'boolean' ? p.dashed : c.dashed,
        bidir: typeof p.bidir === 'boolean' ? p.bidir : c.bidir,
      };
      return found;
    });
    if (found) commit({ ...model, connections });
    return found;
  }
  function invertConnection(id) {
    let found = null;
    const connections = model.connections.map((c) => { if (c.id !== id) return c; found = { ...c, from: c.to, to: c.from }; return found; });
    if (found) commit({ ...model, connections });
    return found;
  }
  function deleteConnection(id) {
    if (!model.connections.some((c) => c.id === id)) return false;
    commit({ ...model, connections: model.connections.filter((c) => c.id !== id) });
    return true;
  }
  function setTitle(title) { commit({ ...model, title: typeof title === 'string' && title.trim() ? title : model.title }); }
  function clearAll() { commit({ ...model, nodes: [], connections: [] }); }
  function replaceModel(raw) { commit(normalizeModel(raw)); }

  // ── Control por agente ─────────────────────────────────────────────────────
  let unregisterAgent = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: 'FossFLOW',
      description: 'Diagrama de flujo isométrico. icon acepta una clave del set nativo (p.ej. "server", "database", "user", "cloud", "shield"), un emoji, o una URL de imagen.',
      tools: [
        { name: 'ADD_NODE', description: 'Agrega un nodo. type ∈ ' + TYPE_ORDER.join('|') + '. icon: clave nativa | emoji | url. x,y,z opcionales.', inputSchema: { type: 'object', properties: { label: { type: 'string' }, type: { type: 'string' }, icon: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }, color: { type: 'string' } } } },
        { name: 'UPDATE_NODE', description: 'Modifica un nodo por id.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, type: { type: 'string' }, icon: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }, color: { type: 'string' } }, required: ['id'] } },
        { name: 'MOVE_NODE', description: 'Reubica un nodo.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }, required: ['id', 'x', 'y'] } },
        { name: 'DELETE_NODE', description: 'Elimina un nodo (y sus conexiones).', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'ADD_CONNECTION', description: 'Conecta dos nodos (from → to).', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } }, required: ['from', 'to'] } },
        { name: 'UPDATE_CONNECTION', description: 'Edita una conexión (label/color/dashed/bidir).', inputSchema: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, color: { type: 'string' }, dashed: { type: 'boolean' }, bidir: { type: 'boolean' } }, required: ['id'] } },
        { name: 'DELETE_CONNECTION', description: 'Elimina una conexión.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        { name: 'SET_TITLE', description: 'Cambia el título.', inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
        { name: 'SET_MODEL', description: 'Reemplaza el diagrama completo.', inputSchema: { type: 'object', properties: { model: { type: 'object' } }, required: ['model'] } },
        { name: 'CLEAR', description: 'Vacía el diagrama.', inputSchema: { type: 'object', properties: {} } },
        { name: 'GET_STATE', description: 'Devuelve el estado actual.', inputSchema: { type: 'object', properties: {} } },
      ],
      getSnapshot: () => ({
        title: model.title,
        nodeCount: model.nodes.length,
        connectionCount: model.connections.length,
        iconKeys: Object.keys(BUILTIN_ICONS),
        nodes: model.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type, icon: iconToString(n.icon), x: n.x, y: n.y, z: n.z })),
        connections: model.connections.map((c) => ({ id: c.id, from: c.from, to: c.to, label: c.label, bidir: c.bidir })),
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        try {
          switch (type) {
            case 'ADD_NODE': { const n = addNode(p); return { success: true, message: 'Nodo "' + n.label + '" (id ' + n.id + ') en (' + n.x + ',' + n.y + ').' }; }
            case 'UPDATE_NODE': { const n = updateNode(String(p.id || ''), p); return n ? { success: true, message: 'Nodo ' + n.id + ' actualizado.' } : { success: false, error: 'No existe el nodo ' + p.id }; }
            case 'MOVE_NODE': { const n = updateNode(String(p.id || ''), { x: p.x, y: p.y, z: p.z }); return n ? { success: true, message: 'Nodo ' + n.id + ' → (' + n.x + ',' + n.y + ',' + n.z + ').' } : { success: false, error: 'No existe el nodo ' + p.id }; }
            case 'DELETE_NODE': return deleteNode(String(p.id || '')) ? { success: true, message: 'Nodo eliminado.' } : { success: false, error: 'No existe el nodo ' + p.id };
            case 'ADD_CONNECTION': { const r = addConnection(p.from, p.to, p.label); return r.ok ? { success: true, message: 'Conexión ' + r.conn.from + ' → ' + r.conn.to + '.' } : { success: false, error: r.message }; }
            case 'UPDATE_CONNECTION': { const c = updateConnection(String(p.id || ''), p); return c ? { success: true, message: 'Conexión ' + c.id + ' actualizada.' } : { success: false, error: 'No existe la conexión ' + p.id }; }
            case 'DELETE_CONNECTION': return deleteConnection(String(p.id || '')) ? { success: true, message: 'Conexión eliminada.' } : { success: false, error: 'No existe la conexión ' + p.id };
            case 'SET_TITLE': setTitle(p.title); return { success: true, message: 'Título actualizado.' };
            case 'SET_MODEL': replaceModel(p.model); return { success: true, message: 'Diagrama reemplazado: ' + model.nodes.length + ' nodo(s), ' + model.connections.length + ' conexión(es).' };
            case 'CLEAR': clearAll(); return { success: true, message: 'Diagrama vaciado.' };
            case 'GET_STATE': return { success: true, message: model.title + ': ' + model.nodes.length + ' nodo(s), ' + model.connections.length + ' conexión(es).' };
            default: return { success: false, error: 'Acción no soportada: ' + type };
          }
        } catch (e) { return { success: false, error: String((e && e.message) || e) }; }
      },
    });
  }

  // ── Geometría de presentación ──────────────────────────────────────────────
  function tileGeometry(node) {
    const P = project(node.x, node.y, node.z);
    const N = [P.sx, P.sy - HHf], E = [P.sx + HWf, P.sy], S = [P.sx, P.sy + HHf], W = [P.sx - HWf, P.sy];
    const dn = (pt) => [pt[0], pt[1] + SLAB];
    const toStr = (pts) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return {
      P,
      top: toStr([N, E, S, W]),
      left: toStr([W, S, dn(S), dn(W)]),
      right: toStr([S, E, dn(E), dn(S)]),
      ring: toStr([[P.sx, P.sy - HHf - 4], [P.sx + HWf + 6, P.sy], [P.sx, P.sy + HHf + 4], [P.sx - HWf - 6, P.sy]]),
      iconCY: P.sy - 20,
      labelY: P.sy + HHf + SLAB + 13,
    };
  }
  function connectionPath(a, b) {
    const pts = [project(a.x, a.y, a.z), project(b.x, a.y, a.z), project(b.x, b.y, b.z)];
    return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.sx.toFixed(1) + ' ' + p.sy.toFixed(1)).join(' ');
  }

  // ── Render de iconos ───────────────────────────────────────────────────────
  // Builtin: <svg> anidado con el cuerpo embebido; tinta con currentColor.
  function builtinSvg(key, size, color, extraProps) {
    const body = BUILTIN_ICONS[key];
    if (!body) return null;
    return h('svg', Object.assign({
      viewBox: '0 0 24 24', width: size, height: size,
      fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      style: { color: color || 'currentColor' },
      dangerouslySetInnerHTML: { __html: body },
    }, extraProps || {}));
  }
  function nodeIconEl(node, cx, cy) {
    const ic = node.icon || { kind: 'builtin', value: 'box' };
    if (ic.kind === 'builtin') {
      const el = builtinSvg(ic.value, ICON_SIZE, node.color, { x: cx - ICON_SIZE / 2, y: cy - ICON_SIZE / 2, className: 'ff-node-svg' });
      if (el) return el;
    }
    if (ic.kind === 'url') {
      return h('image', { href: ic.value, 'xlink:href': ic.value, x: cx - ICON_SIZE / 2, y: cy - ICON_SIZE / 2, width: ICON_SIZE, height: ICON_SIZE, preserveAspectRatio: 'xMidYMid meet', className: 'ff-node-img' });
    }
    return h('text', { x: cx, y: cy, className: 'ff-node-emoji', style: { fontSize: ICON_SIZE + 'px' } }, ic.value);
  }

  // Vista previa (HTML) de un icono para el inspector/picker.
  function iconPreviewHtml(icon, size) {
    const s = size || 26;
    if (icon.kind === 'builtin') {
      const body = BUILTIN_ICONS[icon.value];
      if (body) return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', dangerouslySetInnerHTML: { __html: body } });
    }
    if (icon.kind === 'url') return h('img', { src: icon.value, width: s, height: s, alt: 'icono' });
    return h('span', { style: { fontSize: (s - 4) + 'px' } }, icon.value);
  }

  // ── Selector de iconos (modal) ─────────────────────────────────────────────
  function IconPicker({ onPick, onClose }) {
    const [tab, setTab] = useState('builtin');   // 'builtin' | 'emoji' | 'url'
    const [cat, setCat] = useState(0);
    const [ecat, setEcat] = useState(0);
    const [query, setQuery] = useState('');
    const [urlValue, setUrlValue] = useState('');

    const allKeys = useMemo(() => Object.keys(BUILTIN_ICONS), []);
    const shown = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (q) return allKeys.filter((k) => k.includes(q)).slice(0, 200);
      return (BUILTIN_CATEGORIES[cat].items || []).filter((k) => BUILTIN_ICONS[k]);
    }, [query, cat, allKeys]);

    return h('div', { className: 'ff-modal-overlay', onPointerDown: onClose },
      h('div', { className: 'ff-modal', onPointerDown: (e) => e.stopPropagation() },
        h('div', { className: 'ff-modal-head' },
          h('span', null, 'Elegir icono'),
          h('button', { className: 'ff-icon-btn', onClick: onClose, title: 'Cerrar' }, '✕'),
        ),
        h('div', { className: 'ff-tabs' },
          h('button', { className: 'ff-tab' + (tab === 'builtin' ? ' ff-tab-active' : ''), onClick: () => setTab('builtin') }, 'Iconos'),
          h('button', { className: 'ff-tab' + (tab === 'emoji' ? ' ff-tab-active' : ''), onClick: () => setTab('emoji') }, 'Emojis'),
          h('button', { className: 'ff-tab' + (tab === 'url' ? ' ff-tab-active' : ''), onClick: () => setTab('url') }, 'Importar'),
        ),
        tab === 'builtin'
          ? h('div', null,
              h('input', { className: 'ff-input', placeholder: 'Buscar icono (ej. server, user, cloud, lock)…', value: query, onChange: (e) => setQuery(e.target.value) }),
              !query.trim() ? h('div', { className: 'ff-cat-row' },
                BUILTIN_CATEGORIES.map((c, i) => h('button', { key: c.name, className: 'ff-chip' + (i === cat ? ' ff-chip-active' : ''), onClick: () => setCat(i) }, c.name)),
              ) : null,
              h('div', { className: 'ff-icon-grid' },
                shown.map((k) => h('button', { key: k, className: 'ff-icon-cell', title: k, onClick: () => onPick({ kind: 'builtin', value: k }) }, iconPreviewHtml({ kind: 'builtin', value: k }, 26))),
              ),
            )
          : null,
        tab === 'emoji'
          ? h('div', null,
              h('div', { className: 'ff-cat-row' },
                EMOJI_CATEGORIES.map((c, i) => h('button', { key: c.name, className: 'ff-chip' + (i === ecat ? ' ff-chip-active' : ''), onClick: () => setEcat(i) }, c.name)),
              ),
              h('div', { className: 'ff-emoji-grid' },
                EMOJI_CATEGORIES[ecat].items.map((e, i) => h('button', { key: e + i, className: 'ff-emoji-btn', onClick: () => onPick({ kind: 'emoji', value: e }) }, e)),
              ),
            )
          : null,
        tab === 'url'
          ? h('div', null,
              h('p', { className: 'ff-muted' }, 'Pega la URL de una imagen/SVG o un data-URI (tu icono propio).'),
              h('input', { className: 'ff-input', placeholder: 'https://… o data:image/svg+xml…', autoFocus: true, value: urlValue, onChange: (e) => setUrlValue(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && urlValue.trim()) onPick({ kind: 'url', value: urlValue.trim() }); } }),
              urlValue.trim() ? h('div', { className: 'ff-url-preview' }, h('img', { src: urlValue.trim(), width: 48, height: 48, alt: 'preview' })) : null,
              h('button', { className: 'ff-btn ff-btn-primary ff-block', onClick: () => { if (urlValue.trim()) onPick({ kind: 'url', value: urlValue.trim() }); } }, 'Usar este icono'),
            )
          : null,
      ),
    );
  }

  // ── Componente principal ───────────────────────────────────────────────────
  function Component() {
    const [m, setM] = useState(model);
    const [loadingState, setLoadingState] = useState(true);
    const [view, setView] = useState({ panX: 380, panY: 180, scale: 1 });
    const [selected, setSelected] = useState(null);
    const [connectMode, setConnectMode] = useState(false);
    const [connectFrom, setConnectFrom] = useState(null);
    const [wire, setWire] = useState(null);
    const [editingTitle, setEditingTitle] = useState(false);
    const [picker, setPicker] = useState(null);
    const [showGrid, setShowGrid] = useState(true);

    const svgRef = useRef(null);
    const fileRef = useRef(null);
    const viewRef = useRef(view); viewRef.current = view;
    const interactRef = useRef({ mode: null });
    const movedRef = useRef(false);

    useEffect(() => {
      listeners.add(setM);
      let cancelled = false;
      Promise.resolve(shell.loadData()).then((data) => {
        if (cancelled) return;
        const cfg = data && typeof data === 'object' ? data : null;
        model = normalizeModel(cfg && cfg.model ? cfg.model : cfg);
        loaded = true; setM(model);
      }).catch(() => { loaded = true; }).finally(() => { if (!cancelled) setLoadingState(false); });
      return () => { cancelled = true; listeners.delete(setM); };
    }, []);

    useEffect(() => {
      const onKey = (e) => {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'Escape') { setWire(null); setConnectFrom(null); setSelected(null); setPicker(null); return; }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
          if (selected.kind === 'node') deleteNode(selected.id); else deleteConnection(selected.id);
          setSelected(null); e.preventDefault(); return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && selected && selected.kind === 'node') {
          const dup = duplicateNode(selected.id); if (dup) setSelected({ kind: 'node', id: dup.id }); e.preventDefault();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [selected]);

    const clientToGroup = useCallback((evt) => {
      const svg = svgRef.current; if (!svg) return { gx: 0, gy: 0 };
      const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      const ctm = svg.getScreenCTM(); if (!ctm) return { gx: 0, gy: 0 };
      const u = pt.matrixTransform(ctm.inverse());
      const v = viewRef.current;
      return { gx: (u.x - v.panX) / v.scale, gy: (u.y - v.panY) / v.scale };
    }, []);
    const nodeAtClient = useCallback((evt) => {
      const { gx, gy } = clientToGroup(evt);
      const cell = unproject(gx, gy, 0);
      return model.nodes.find((n) => n.x === cell.x && n.y === cell.y) || null;
    }, [clientToGroup]);

    const onNodePointerDown = useCallback((evt, node) => {
      evt.stopPropagation();
      if (connectMode) {
        if (!connectFrom) { setConnectFrom(node.id); setSelected({ kind: 'node', id: node.id }); }
        else if (connectFrom === node.id) setConnectFrom(null);
        else { const r = addConnection(connectFrom, node.id); if (!r.ok) notify('warn', r.message); setConnectFrom(null); }
        return;
      }
      try { evt.currentTarget.setPointerCapture(evt.pointerId); } catch { /* no-op */ }
      interactRef.current = { mode: 'drag', nodeId: node.id, z: node.z };
      movedRef.current = false;
      setSelected({ kind: 'node', id: node.id });
    }, [connectMode, connectFrom]);

    const onPortPointerDown = useCallback((evt, node) => {
      evt.stopPropagation();
      try { svgRef.current && svgRef.current.setPointerCapture(evt.pointerId); } catch { /* no-op */ }
      const P = project(node.x, node.y, node.z);
      interactRef.current = { mode: 'wire', fromId: node.id };
      setWire({ fromId: node.id, sx: P.sx, sy: P.sy - 20, hoverId: null });
    }, []);

    const onSvgPointerDown = useCallback((evt) => {
      if (interactRef.current.mode) return;
      const v = viewRef.current;
      interactRef.current = { mode: 'pan', startX: evt.clientX, startY: evt.clientY, panX: v.panX, panY: v.panY };
      movedRef.current = false;
    }, []);

    const onSvgPointerMove = useCallback((evt) => {
      const it = interactRef.current;
      if (!it.mode) return;
      if (it.mode === 'drag') {
        const { gx, gy } = clientToGroup(evt);
        const cell = unproject(gx, gy, it.z || 0);
        const node = nodeById(it.nodeId);
        if (node && (node.x !== cell.x || node.y !== cell.y)) { movedRef.current = true; updateNode(it.nodeId, { x: cell.x, y: cell.y }); }
      } else if (it.mode === 'wire') {
        const { gx, gy } = clientToGroup(evt);
        const tgt = nodeAtClient(evt);
        setWire((w) => w ? { ...w, sx: gx, sy: gy, hoverId: tgt && tgt.id !== it.fromId ? tgt.id : null } : w);
      } else if (it.mode === 'pan') {
        const dx = evt.clientX - it.startX, dy = evt.clientY - it.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
        setView((vw) => ({ ...vw, panX: it.panX + dx, panY: it.panY + dy }));
      }
    }, [clientToGroup, nodeAtClient]);

    const onSvgPointerUp = useCallback((evt) => {
      const it = interactRef.current;
      interactRef.current = { mode: null };
      if (it.mode === 'wire') {
        const tgt = nodeAtClient(evt);
        if (tgt && tgt.id !== it.fromId) { const r = addConnection(it.fromId, tgt.id); if (r.ok) setSelected({ kind: 'conn', id: r.conn.id }); else notify('warn', r.message); }
        setWire(null); return;
      }
      if (it.mode === 'pan' && !movedRef.current) setSelected(null);
    }, [nodeAtClient]);

    const onSvgDoubleClick = useCallback((evt) => {
      if (connectMode) return;
      const { gx, gy } = clientToGroup(evt);
      const cell = unproject(gx, gy, 0);
      if (model.nodes.some((n) => n.x === cell.x && n.y === cell.y)) return;
      const n = addNode({ x: cell.x, y: cell.y, type: 'generic' });
      setSelected({ kind: 'node', id: n.id });
    }, [clientToGroup, connectMode]);

    const onWheel = useCallback((evt) => {
      evt.preventDefault();
      setView((vw) => ({ ...vw, scale: Math.max(0.35, Math.min(2.6, vw.scale * (evt.deltaY < 0 ? 1.1 : 1 / 1.1))) }));
    }, []);
    const zoomBy = (f) => setView((vw) => ({ ...vw, scale: Math.max(0.35, Math.min(2.6, vw.scale * f)) }));

    const fitView = useCallback(() => {
      if (!model.nodes.length) { setView({ panX: 380, panY: 180, scale: 1 }); return; }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of model.nodes) {
        const p = project(n.x, n.y, n.z);
        minX = Math.min(minX, p.sx - HW); maxX = Math.max(maxX, p.sx + HW);
        minY = Math.min(minY, p.sy - 60); maxY = Math.max(maxY, p.sy + HH);
      }
      const svg = svgRef.current; const rect = svg ? svg.getBoundingClientRect() : { width: 800, height: 500 };
      const w = Math.max(1, maxX - minX), hgt = Math.max(1, maxY - minY);
      const scale = Math.max(0.35, Math.min(1.8, Math.min((rect.width - 80) / w, (rect.height - 80) / hgt)));
      setView({ scale, panX: rect.width / 2 - ((minX + maxX) / 2) * scale, panY: rect.height / 2 - ((minY + maxY) / 2) * scale });
    }, []);

    const exportJSON = useCallback(() => {
      try {
        const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (model.title || 'diagrama').replace(/[^\w\-]+/g, '_') + '.fossflow.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch { notify('error', 'No se pudo exportar'); }
    }, []);
    const importJSON = useCallback((file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { try { replaceModel(JSON.parse(String(reader.result))); notify('success', 'Diagrama importado'); } catch { notify('error', 'Archivo inválido'); } };
      reader.readAsText(file);
    }, []);

    const applyIcon = useCallback((icon) => {
      if (!picker) return;
      if (picker.targetId) updateNode(picker.targetId, { icon });
      else { const n = addNode({ icon }); setSelected({ kind: 'node', id: n.id }); }
      setPicker(null);
    }, [picker]);

    const sortedNodes = useMemo(() => m.nodes.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z || (a.id < b.id ? -1 : 1)), [m.nodes]);
    const nodeMap = useMemo(() => { const o = {}; for (const n of m.nodes) o[n.id] = n; return o; }, [m.nodes]);
    const selectedNode = selected && selected.kind === 'node' ? nodeMap[selected.id] : null;
    const selectedConn = selected && selected.kind === 'conn' ? m.connections.find((c) => c.id === selected.id) : null;

    const gridLines = useMemo(() => {
      if (!showGrid) return null;
      const lines = [];
      for (let i = -GRID; i <= GRID; i++) {
        const a = project(i, -GRID, 0), b = project(i, GRID, 0);
        lines.push(h('line', { key: 'gx' + i, x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, className: 'ff-grid-line' }));
        const c = project(-GRID, i, 0), d = project(GRID, i, 0);
        lines.push(h('line', { key: 'gy' + i, x1: c.sx, y1: c.sy, x2: d.sx, y2: d.sy, className: 'ff-grid-line' }));
      }
      return lines;
    }, [showGrid]);

    if (loadingState) return h('div', { className: 'kimos-fossflow ff-loading' }, 'Cargando diagrama…');

    const tBtn = (active, title, label, onClick) => h('button', { className: 'ff-btn' + (active ? ' ff-btn-active' : ''), title, onClick }, label);

    return h('div', { className: 'kimos-fossflow' },
      h('div', { className: 'ff-toolbar' },
        editingTitle
          ? h('input', { className: 'ff-title-input', autoFocus: true, defaultValue: m.title,
              onBlur: (e) => { setTitle(e.target.value); setEditingTitle(false); },
              onKeyDown: (e) => { if (e.key === 'Enter') { setTitle(e.target.value); setEditingTitle(false); } if (e.key === 'Escape') setEditingTitle(false); } })
          : h('span', { className: 'ff-title', title: 'Doble click para renombrar', onDoubleClick: () => setEditingTitle(true) }, '🧊 ' + m.title),
        h('span', { className: 'ff-stats' }, m.nodes.length + ' nodo' + (m.nodes.length === 1 ? '' : 's') + ' · ' + m.connections.length + ' conexión' + (m.connections.length === 1 ? '' : 'es')),
        h('div', { className: 'ff-spacer' }),
        tBtn(connectMode, 'Conectar: clic en origen y luego en destino (o arrastra el puerto ⊕ de un nodo)', connectMode ? '🔗 Conectando…' : '🔗 Conectar', () => { setConnectMode((v) => !v); setConnectFrom(null); }),
        tBtn(showGrid, 'Mostrar/ocultar grilla', '▦', () => setShowGrid((v) => !v)),
        h('button', { className: 'ff-btn', title: 'Exportar JSON', onClick: exportJSON }, '⤓'),
        h('button', { className: 'ff-btn', title: 'Importar JSON', onClick: () => fileRef.current && fileRef.current.click() }, '⤒'),
        h('input', { ref: fileRef, type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onChange: (e) => { importJSON(e.target.files && e.target.files[0]); e.target.value = ''; } }),
        h('div', { className: 'ff-zoom' },
          h('button', { className: 'ff-icon-btn', title: 'Alejar', onClick: () => zoomBy(1 / 1.1) }, '−'),
          h('button', { className: 'ff-icon-btn', title: 'Ajustar a contenido', onClick: fitView }, '⤢'),
          h('button', { className: 'ff-icon-btn', title: 'Acercar', onClick: () => zoomBy(1.1) }, '+'),
        ),
      ),
      h('div', { className: 'ff-palette' },
        QUICK_ICONS.filter((k) => BUILTIN_ICONS[k]).map((k) => h('button', { key: k, className: 'ff-pal-icon', title: 'Agregar nodo: ' + k, onClick: () => { const n = addNode({ icon: k }); setSelected({ kind: 'node', id: n.id }); } }, iconPreviewHtml({ kind: 'builtin', value: k }, 20))),
        h('button', { className: 'ff-pal-more', title: 'Catálogo de iconos nativos / emojis / importar', onClick: () => setPicker(selectedNode ? { targetId: selectedNode.id } : { create: true }) }, '🔍 Más iconos…'),
      ),
      h('div', { className: 'ff-stage' },
        h('svg', { ref: svgRef, className: 'ff-canvas' + (connectMode ? ' ff-canvas-connect' : ''), xmlns: 'http://www.w3.org/2000/svg',
          onPointerDown: onSvgPointerDown, onPointerMove: onSvgPointerMove, onPointerUp: onSvgPointerUp, onPointerLeave: onSvgPointerUp,
          onDoubleClick: onSvgDoubleClick, onWheel },
          h('defs', null,
            h('marker', { id: 'ff-arrow', viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
              h('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'context-stroke' })),
          ),
          h('g', { transform: 'translate(' + view.panX + ',' + view.panY + ') scale(' + view.scale + ')' },
            gridLines ? h('g', { className: 'ff-grid' }, gridLines) : null,
            h('g', { className: 'ff-connections' },
              m.connections.map((c) => {
                const a = nodeMap[c.from], b = nodeMap[c.to]; if (!a || !b) return null;
                const mid = project(b.x, a.y, a.z);
                const isSel = selectedConn && selectedConn.id === c.id;
                const stroke = isSel ? '#19ACB1' : c.color;
                const d = connectionPath(a, b);
                return h('g', { key: c.id, className: 'ff-conn' + (isSel ? ' ff-conn-sel' : ''), onPointerDown: (e) => { e.stopPropagation(); setSelected({ kind: 'conn', id: c.id }); } },
                  h('path', { d, className: 'ff-conn-hit' }),
                  h('path', { d, className: 'ff-conn-line', stroke, strokeDasharray: c.dashed ? '7 5' : 'none', markerEnd: 'url(#ff-arrow)', markerStart: c.bidir ? 'url(#ff-arrow)' : 'none' }),
                  c.label ? h('text', { x: mid.sx, y: mid.sy - 5, className: 'ff-conn-label' }, c.label) : null,
                );
              }),
            ),
            wire ? (function () { const from = nodeById(wire.fromId); if (!from) return null; const P = project(from.x, from.y, from.z); return h('line', { x1: P.sx, y1: P.sy - 20, x2: wire.sx, y2: wire.sy, className: 'ff-wire' }); })() : null,
            h('g', { className: 'ff-nodes' },
              sortedNodes.map((node) => {
                const g = tileGeometry(node);
                const isSel = selected && selected.kind === 'node' && selected.id === node.id;
                const isFrom = connectFrom === node.id;
                const isHover = wire && wire.hoverId === node.id;
                return h('g', { key: node.id,
                  className: 'ff-node' + (isSel ? ' ff-node-sel' : '') + (isFrom ? ' ff-node-from' : '') + (isHover ? ' ff-node-hover' : '') + (connectMode ? ' ff-node-link' : ''),
                  onPointerDown: (e) => onNodePointerDown(e, node) },
                  h('ellipse', { cx: g.P.sx, cy: g.P.sy + SLAB, rx: HWf, ry: HHf, className: 'ff-node-shadow' }),
                  (isSel || isHover || isFrom) ? h('polygon', { points: g.ring, className: 'ff-node-ring' }) : null,
                  h('polygon', { points: g.left, fill: shade(node.color, -0.18), className: 'ff-tile-side' }),
                  h('polygon', { points: g.right, fill: shade(node.color, -0.30), className: 'ff-tile-side' }),
                  h('polygon', { points: g.top, fill: rgba(node.color, 0.22), stroke: rgba(node.color, 0.9), className: 'ff-tile-top' }),
                  nodeIconEl(node, g.P.sx, g.iconCY),
                  h('text', { x: g.P.sx, y: g.labelY, className: 'ff-node-label' }, node.label),
                  (isSel || connectMode) ? h('g', { className: 'ff-port', onPointerDown: (e) => onPortPointerDown(e, node) },
                    h('circle', { cx: g.P.sx, cy: g.iconCY - ICON_SIZE / 2 - 8, r: 7, className: 'ff-port-dot' }),
                    h('text', { x: g.P.sx, y: g.iconCY - ICON_SIZE / 2 - 8, className: 'ff-port-plus' }, '+'),
                  ) : null,
                );
              }),
            ),
          ),
        ),
        (selectedNode || selectedConn)
          ? h('div', { className: 'ff-inspector' },
              selectedNode
                ? h('div', null,
                    h('div', { className: 'ff-insp-head' }, 'Nodo'),
                    h('div', { className: 'ff-icon-preview' },
                      h('div', { className: 'ff-icon-box', style: { color: selectedNode.color } }, iconPreviewHtml(selectedNode.icon, 40)),
                      h('button', { className: 'ff-btn ff-btn-primary', onClick: () => setPicker({ targetId: selectedNode.id }) }, 'Cambiar icono'),
                    ),
                    h('label', { className: 'ff-lbl' }, 'Etiqueta'),
                    h('input', { className: 'ff-input', value: selectedNode.label, onChange: (e) => updateNode(selectedNode.id, { label: e.target.value }) }),
                    h('label', { className: 'ff-lbl' }, 'Tipo (color base)'),
                    h('select', { className: 'ff-input', value: selectedNode.type, onChange: (e) => updateNode(selectedNode.id, { type: e.target.value, color: TYPES[e.target.value].color }) },
                      TYPE_ORDER.map((t) => h('option', { key: t, value: t }, TYPES[t].label))),
                    h('label', { className: 'ff-lbl' }, 'Color'),
                    h('input', { className: 'ff-color', type: 'color', value: selectedNode.color, onChange: (e) => updateNode(selectedNode.id, { color: e.target.value }) }),
                    h('div', { className: 'ff-row' },
                      h('div', null, h('label', { className: 'ff-lbl' }, 'X'), h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.x, onChange: (e) => updateNode(selectedNode.id, { x: parseInt(e.target.value, 10) }) })),
                      h('div', null, h('label', { className: 'ff-lbl' }, 'Y'), h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.y, onChange: (e) => updateNode(selectedNode.id, { y: parseInt(e.target.value, 10) }) })),
                      h('div', null, h('label', { className: 'ff-lbl' }, 'Z'), h('input', { className: 'ff-input ff-num', type: 'number', value: selectedNode.z, onChange: (e) => updateNode(selectedNode.id, { z: parseInt(e.target.value, 10) }) })),
                    ),
                    h('div', { className: 'ff-row ff-mt' },
                      h('button', { className: 'ff-btn ff-flex', onClick: () => { const d = duplicateNode(selectedNode.id); if (d) setSelected({ kind: 'node', id: d.id }); } }, '⧉ Duplicar'),
                      h('button', { className: 'ff-btn ff-btn-danger ff-flex', onClick: () => { deleteNode(selectedNode.id); setSelected(null); } }, '🗑️ Eliminar'),
                    ),
                  )
                : h('div', null,
                    h('div', { className: 'ff-insp-head' }, 'Conexión'),
                    h('div', { className: 'ff-insp-sub' }, (nodeMap[selectedConn.from]?.label || selectedConn.from) + ' → ' + (nodeMap[selectedConn.to]?.label || selectedConn.to)),
                    h('label', { className: 'ff-lbl' }, 'Etiqueta'),
                    h('input', { className: 'ff-input', value: selectedConn.label, placeholder: 'Texto del flujo…', onChange: (e) => updateConnection(selectedConn.id, { label: e.target.value }) }),
                    h('label', { className: 'ff-lbl' }, 'Color'),
                    h('input', { className: 'ff-color', type: 'color', value: selectedConn.color, onChange: (e) => updateConnection(selectedConn.id, { color: e.target.value }) }),
                    h('div', { className: 'ff-check-row' },
                      h('label', { className: 'ff-check' }, h('input', { type: 'checkbox', checked: selectedConn.dashed, onChange: (e) => updateConnection(selectedConn.id, { dashed: e.target.checked }) }), ' Punteada'),
                      h('label', { className: 'ff-check' }, h('input', { type: 'checkbox', checked: selectedConn.bidir, onChange: (e) => updateConnection(selectedConn.id, { bidir: e.target.checked }) }), ' Bidireccional'),
                    ),
                    h('button', { className: 'ff-btn ff-block', onClick: () => invertConnection(selectedConn.id) }, '⇄ Invertir sentido'),
                    h('button', { className: 'ff-btn ff-btn-danger ff-block', onClick: () => { deleteConnection(selectedConn.id); setSelected(null); } }, '🗑️ Eliminar conexión'),
                  ),
            )
          : h('div', { className: 'ff-inspector ff-inspector-empty' },
              h('p', null, h('b', null, 'Crear nodo:'), ' doble clic en el lienzo, o usa la paleta de arriba.'),
              h('p', null, h('b', null, 'Iconos:'), ' selecciona un nodo y pulsa “Cambiar icono” (set nativo, emojis o importar por URL).'),
              h('p', null, h('b', null, 'Conectar:'), ' arrastra el puerto ⊕ de un nodo hasta otro, o usa el modo 🔗 Conectar.'),
              h('p', null, h('b', null, 'Editar conexión:'), ' haz clic sobre la línea para cambiar etiqueta, color, punteada, bidireccional o invertir.'),
              h('p', { className: 'ff-muted' }, 'Atajos: Supr borra · Esc cancela · Ctrl/Cmd+D duplica. Un agente autorizado puede editar el diagrama y el lienzo se actualiza solo.'),
            ),
      ),
      picker ? h(IconPicker, { onPick: applyIcon, onClose: () => setPicker(null) }) : null,
    );
  }

  return {
    Component,
    unmount() {
      if (saveTimer) clearTimeout(saveTimer);
      listeners.clear();
      if (typeof unregisterAgent === 'function') { try { unregisterAgent(); } catch { /* no-op */ } }
    },
  };
}
