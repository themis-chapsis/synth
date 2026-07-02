/**
 * Packages the built app into a single self-contained HTML file that runs
 * from a double-clicked file:// page — no server, no install.
 *
 * Everything is inlined: the Vite app bundle (as an inline module script),
 * the CSS with the silkscreen font as base64, the AudioWorklet DSP source
 * as a string (loaded from a blob URL at runtime), and both factory SysEx
 * banks as base64. Run `npm run build` first, then this.
 *
 * Usage: node scripts/build-standalone.mjs [outfile]
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = process.argv[2] ?? join(root, 'FM6-synth.html');

const assets = readdirSync(join(dist, 'assets'));
const jsName = assets.find((f) => f.startsWith('index-') && f.endsWith('.js'));
const cssName = assets.find((f) => f.endsWith('.css'));

let css = readFileSync(join(dist, 'assets', cssName), 'utf8');
// Inline each woff2 font referenced by the CSS as a base64 data URL.
css = css.replace(/url\(([^)]*?fonts\/([^)]+?\.woff2))\)/g, (_m, _full, file) => {
  const b64 = readFileSync(join(dist, 'fonts', file)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});

const appJs = readFileSync(join(dist, 'assets', jsName), 'utf8');

// The worklet DSP core is authored self-contained (no imports); embed the
// original source verbatim so addModule can load it from a blob URL.
const workletSrc = readFileSync(join(root, 'src', 'engine', 'dx7-processor.js'), 'utf8');

const banks = {
  internal: readFileSync(join(root, 'src', 'sysex', 'rom1a.syx')).toString('base64'),
  cartridge: readFileSync(join(root, 'src', 'sysex', 'rom1b.syx')).toString('base64')
};

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230d0e0e'/%3E%3Crect x='3' y='6' width='10' height='4' fill='%235fb8c9'/%3E%3C/svg%3E";

// JSON.stringify safely escapes the worklet source and base64 for embedding
// inside a classic <script> that runs before the deferred app module.
const preamble =
  `window.__DX7_WORKLET_SRC__=${JSON.stringify(workletSrc)};\n` +
  `window.__DX7_BANKS__=${JSON.stringify(banks)};`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FM6 Synth</title>
<link rel="icon" href="${favicon}">
<style>${css}</style>
</head>
<body>
<main class="stage"><div id="app" class="panel-wrap"></div></main>
<script>${preamble}</script>
<script type="module">${appJs}</script>
</body>
</html>
`;

writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`wrote ${out} (${kb} KB)`);
