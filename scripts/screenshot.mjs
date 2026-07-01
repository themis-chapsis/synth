/**
 * Visual-test helper (spec 15.2): renders the panel in headless Chromium
 * and writes a screenshot.
 *
 * Usage: node scripts/screenshot.mjs [url] [outfile]
 * Defaults: http://localhost:4173 (vite preview) -> panel.png
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'panel.png';

// The sandbox pre-installs Chromium at a fixed path; a version-pinned
// download is unavailable here (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD).
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1960, height: 320 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`wrote ${out}`);
