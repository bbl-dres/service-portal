// Rendered baseline checks for the CD review. This reports rather than mutates;
// documented exceptions such as inline prose links are assessed in the review.
//
//   APP_BASE=http://localhost:8848/# node scripts/review-audit.mjs
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';
import { REVIEW_ROUTES, REVIEW_VIEWPORTS } from './review-routes.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const cdp = await launch({ webgl: true });
const findings = [];
const totals = {
  routes: 0, overflow: 0, h1: 0, duplicateIds: 0, labels: 0,
  images: 0, headings: 0, tables: 0, targets: 0,
};

const probe = `(() => {
  const visible = (el) => {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && !el.hidden && r.width > 0 && r.height > 0;
  };
  const nameOf = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') ||
    (el.labels && [...el.labels].map(x => x.textContent).join(' ')) || el.textContent || '').trim();
  const allIds = [...document.querySelectorAll('[id]')].map(el => el.id).filter(Boolean);
  const duplicateIds = [...new Set(allIds.filter((id, i) => allIds.indexOf(id) !== i))];
  const controls = [...document.querySelectorAll(
    'button,input:not([type=hidden]),select,textarea,[role=button],a.btn')].filter(visible);
  const unnamed = controls.filter(el => !nameOf(el)).map(el => el.outerHTML.slice(0, 120));
  const small = controls.map(el => {
    const r = el.getBoundingClientRect();
    return { el, w: Math.round(r.width), h: Math.round(r.height) };
  }).filter(x => x.w < 44 || x.h < 44).map(x => ({
    tag: x.el.tagName.toLowerCase(), cls: String(x.el.className || ''),
    name: nameOf(x.el), w: x.w, h: x.h,
  }));
  const badImages = [...document.images].filter(img => !img.hasAttribute('alt'))
    .map(img => img.currentSrc || img.src);
  // Header and footer are independent landmarks with their own heading
  // hierarchy. Page-content jumps are assessed inside main only.
  const hs = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3,#main-content h4,#main-content h5,#main-content h6')].filter(visible);
  const jumps = []; let prior = 0;
  for (const h of hs) {
    const level = Number(h.tagName[1]);
    if (prior && level > prior + 1) jumps.push(prior + '>' + level + ':' + h.textContent.trim());
    prior = level;
  }
  const badTables = [...document.querySelectorAll('table')].filter(visible).map((table, i) => ({
    i, caption: !!table.querySelector('caption'),
    unscoped: [...table.querySelectorAll('th')].filter(th => !th.hasAttribute('scope')).length,
  })).filter(x => !x.caption || x.unscoped);
  return {
    title: document.querySelector('h1')?.textContent.trim() || '',
    overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - document.documentElement.clientWidth,
    h1: document.querySelectorAll('h1').length,
    duplicateIds, unnamed, badImages, jumps, badTables, small,
  };
})()`;

try {
  const page = await openPage(cdp, `${APP_BASE}/`);
  for (const width of REVIEW_VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    for (const item of REVIEW_ROUTES) {
      await page.evaluate(`location.hash = '#${item.route}'; true`);
      await sleep(item.slow ? 1400 : 450);
      await page.evaluate('document.fonts.ready');
      const r = await page.evaluate(probe);
      totals.routes++;
      const issues = [];
      if (r.overflow > 1) { totals.overflow++; issues.push(`overflow ${r.overflow}px`); }
      if (r.h1 !== 1) { totals.h1++; issues.push(`h1 ${r.h1}`); }
      if (r.duplicateIds.length) {
        totals.duplicateIds += r.duplicateIds.length;
        issues.push(`duplicate ids ${r.duplicateIds.join(',')}`);
      }
      if (r.unnamed.length) { totals.labels += r.unnamed.length; issues.push(`unnamed controls ${r.unnamed.length}`); }
      if (r.badImages.length) { totals.images += r.badImages.length; issues.push(`images without alt ${r.badImages.length}`); }
      if (r.jumps.length) { totals.headings += r.jumps.length; issues.push(`heading jumps ${r.jumps.length}`); }
      if (r.badTables.length) { totals.tables += r.badTables.length; issues.push(`table semantics ${r.badTables.length}`); }
      if (r.small.length) { totals.targets += r.small.length; issues.push(`targets <44px ${r.small.length}`); }
      if (issues.length) findings.push({
        width, route: item.route, title: r.title, issues,
        small: r.small.slice(0, 8), tables: r.badTables, headings: r.jumps,
      });
      console.log(`${width}px ${item.route} ${issues.length ? 'WARN ' + issues.join(' | ') : 'ok'}`);
    }
  }
  await page.closeTarget();
} finally { cdp.close(); }

console.log('\nSUMMARY ' + JSON.stringify(totals));
console.log('DETAILS ' + JSON.stringify(findings));
mkdirSync('docs/review-assets', { recursive: true });
writeFileSync('docs/review-assets/audit.json', JSON.stringify({
  generated: new Date().toISOString(), viewports: REVIEW_VIEWPORTS,
  routes: REVIEW_ROUTES.map(x => x.route), totals, findings,
}, null, 2));
