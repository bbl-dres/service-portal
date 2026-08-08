// Design-review screenshots: render every route as a full-page PNG at
// 320/768/1440. Comparing docs/review-assets/before and after is the visual
// regression record for the refactoring waves.
//
//   APP_BASE=http://localhost:8848/# node scripts/review-screenshots.mjs <before|after>
//   REVIEW_OUTPUT_DIR=<temp> node scripts/review-screenshots.mjs current
//   REVIEW_SLUGS=app_floorplan-editor,app_floorplan-editor_edit …  # optional subset
//
// Enable WebGL for MapLibre maps and scroll once before capture so lazy images
// have loaded.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEW_ROUTES, REVIEW_VIEWPORTS } from './review-routes.mjs';

const MODE = process.argv[2];
if (!['before', 'after', 'current'].includes(MODE)) {
  throw new Error('Mode required: before, after or current.');
}
if (MODE === 'current' && !process.env.REVIEW_OUTPUT_DIR) {
  throw new Error('Mode current requires REVIEW_OUTPUT_DIR so tracked baselines remain unchanged.');
}
const REVIEW_ASSETS = process.env.REVIEW_OUTPUT_DIR
  ? resolve(process.env.REVIEW_OUTPUT_DIR)
  : fileURLToPath(new URL('../docs/review-assets/', import.meta.url));
const OUT = join(REVIEW_ASSETS, MODE);
const requestedSlugs = new Set(String(process.env.REVIEW_SLUGS || '').split(',').map(value => value.trim()).filter(Boolean));
const routes = requestedSlugs.size ? REVIEW_ROUTES.filter(item => requestedSlugs.has(item.slug)) : REVIEW_ROUTES;
if (!routes.length) throw new Error('REVIEW_SLUGS does not match a review route.');

const cdp = await launch({ webgl: true });
try {
  for (const w of REVIEW_VIEWPORTS) mkdirSync(join(OUT, String(w)), { recursive: true });
  // Start signed in so the matrix exercises every micro-app rather than only
  // the router's mock sign-in gate.
  const page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await sleep(1500);

  for (const w of REVIEW_VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    for (const { route, slug, slow } of routes) {
      await page.evaluate(`(() => {
        const next = '#${route}';
        if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
        else location.hash = next;
        return true;
      })()`);
      await sleep(slow ? 3200 : 1100);
      // Scroll to the end and back to load images and settle sticky elements.
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
console.log(`Finished → ${OUT}`);
