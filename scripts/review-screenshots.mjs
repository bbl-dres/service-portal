// Design-Review-Screenshots: jede Route in drei Viewports (320/768/1440) als
// Ganzseiten-PNG. Vorher-Stand nach docs/review-assets/before/, Nachher-Stand
// nach docs/review-assets/after/ — der Vergleich der beiden Ordner ist die
// Regressionsprüfung der Refactoring-Wellen (docs/design-review.md, Phase 0/5).
//
//   APP_BASE=http://localhost:8848/# node scripts/review-screenshots.mjs [before|after]
//
// WebGL an, damit die MapLibre-Karten (Datenportal, Portfolio) rendern; vor der
// Aufnahme wird einmal durchgescrollt, damit lazy geladene Bilder im Bild sind.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODE = process.argv[2] || 'before';
const OUT = join('docs', 'review-assets', MODE);

// Identisch mit test-routes.mjs — die Routenliste IST das Prüfraster.
const ROUTES = [
  '/', '/services', '/services/stoerung-melden', '/applications',
  '/applications?area=buildings', '/data', '/data/catalog', '/data/digitalisation',
  '/data/digitalisation/strategy', '/data/digitalisation/principles',
  '/data/ict-projects', '/knowledge', '/knowledge/it', '/knowledge/procurement',
  '/knowledge/accommodation', '/knowledge/publishing', '/knowledge/guides',
  '/knowledge/processes', '/news', '/my-cases', '/search?q=bau',
  '/app/portfolio', '/app/media-library', '/app/dataportal', '/app/projects',
  '/app/tenancies', '/app/metadata-catalog', '/app/process-docs',
  '/app/document-archive', '/app/space-request', '/app/fault-report',
  '/app/building-create', '/app/workspace', '/app/transaction', '/app/api-docs',
];
// Karten- und diagrammlastige Routen brauchen länger, bis WebGL/Charts stehen.
const SLOW = new Set(['/app/dataportal', '/app/portfolio', '/app/workspace', '/app/tenancies']);
const VIEWPORTS = [320, 768, 1440];

const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/[/?=&]/g, '_'));

const cdp = await launch({ webgl: true });
try {
  for (const w of VIEWPORTS) mkdirSync(join(OUT, String(w)), { recursive: true });
  const page = await openPage(cdp, `${APP_BASE}/`);
  await sleep(1500);

  for (const w of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    for (const route of ROUTES) {
      await page.evaluate(`location.hash = '#${route}'; true`);
      await sleep(SLOW.has(route) ? 3200 : 1100);
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
      writeFileSync(join(OUT, String(w), slug(route) + '.png'), Buffer.from(data, 'base64'));
      console.log(`  ${w}px ${route}`);
    }
  }
  await page.closeTarget();
} finally { cdp.close(); }
console.log(`Fertig → ${OUT}`);
