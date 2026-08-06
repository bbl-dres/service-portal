// Design-Review-Screenshots: jede Route in drei Viewports (320/768/1440) als
// Ganzseiten-PNG. Vorher-Stand nach docs/review-assets/before/, Nachher-Stand
// nach docs/review-assets/after/ — der Vergleich der beiden Ordner ist die
// Regressionsprüfung der Refactoring-Wellen (docs/design-review.md, Phase 0/5).
//
//   APP_BASE=http://localhost:8848/# node scripts/review-screenshots.mjs <before|after>
//   REVIEW_OUTPUT_DIR=<temp> node scripts/review-screenshots.mjs current
//
// WebGL an, damit die MapLibre-Karten (Datenportal, Portfolio) rendern; vor der
// Aufnahme wird einmal durchgescrollt, damit lazy geladene Bilder im Bild sind.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEW_ROUTES, REVIEW_VIEWPORTS } from './review-routes.mjs';

const MODE = process.argv[2];
if (!['before', 'after', 'current'].includes(MODE)) {
  throw new Error('Modus erforderlich: before, after oder current.');
}
if (MODE === 'current' && !process.env.REVIEW_OUTPUT_DIR) {
  throw new Error('Der Modus current verlangt REVIEW_OUTPUT_DIR, damit kein getracktes Baseline-Paar verändert wird.');
}
const REVIEW_ASSETS = process.env.REVIEW_OUTPUT_DIR
  ? resolve(process.env.REVIEW_OUTPUT_DIR)
  : fileURLToPath(new URL('../docs/review-assets/', import.meta.url));
const OUT = join(REVIEW_ASSETS, MODE);

const cdp = await launch({ webgl: true });
try {
  for (const w of REVIEW_VIEWPORTS) mkdirSync(join(OUT, String(w)), { recursive: true });
  // Angemeldet: die Prüfmatrix läuft ALLE Zustände per Hash-Navigation ab,
  // darunter die Fachanwendungen — die liegen seit 2026-08 hinter der
  // Anmeldesperre (js/router.js) und zeigten sonst nur noch deren Band.
  const page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await sleep(1500);

  for (const w of REVIEW_VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    for (const { route, slug, slow } of REVIEW_ROUTES) {
      await page.evaluate(`location.hash = '#${route}'; true`);
      await sleep(slow ? 3200 : 1100);
      // Einmal ans Ende und zurück: lazy Bilder laden, sticky Zustände beruhigen.
      await page.evaluate(`(async () => {
        await document.fonts.ready;
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
        await new Promise(r => requestAnimationFrame(() => r()));
      })()`);
      await sleep(250);
      const { contentSize } = await cdp.send('Page.getLayoutMetrics', {}, page.sessionId);
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: w, height: Math.min(contentSize.height, 12000), scale: 1 },
      }, page.sessionId);
      writeFileSync(join(OUT, String(w), slug + '.png'), Buffer.from(data, 'base64'));
      console.log(`  ${w}px ${route}`);
    }
  }
  await page.closeTarget();
} finally { cdp.close(); }
console.log(`Fertig → ${OUT}`);
