// Rendered baseline checks for the CD review. This reports rather than mutates;
// documented exceptions such as inline prose links are assessed in the review.
//
//   APP_BASE=http://localhost:8848/# node scripts/review-audit.mjs
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';
import { REVIEW_ROUTES, REVIEW_VIEWPORTS } from './review-routes.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cdp = await launch({ webgl: true });
const REVIEW_ASSETS = process.env.REVIEW_OUTPUT_DIR
  ? resolve(process.env.REVIEW_OUTPUT_DIR)
  : fileURLToPath(new URL('../docs/review-assets/', import.meta.url));
const findings = [];
const totals = {
  routes: 0, overflow: 0, h1: 0, duplicateIds: 0, labels: 0,
  images: 0, headings: 0, tables: 0, targets: 0, compactTargets: 0,
};
const advisories = [];

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
  const targetPolicy = innerWidth < 1024 || matchMedia('(pointer:coarse)').matches || matchMedia('(hover:none)').matches;
  const minimumTarget = targetPolicy ? 44 : 24;
  const measured = controls.map(el => {
    const isChoice = el.matches('input[type="checkbox"],input[type="radio"]');
    const explicitLabel = isChoice && el.id
      ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
    const hitTarget = isChoice ? (el.closest('label') || explicitLabel || el) : el;
    const r = hitTarget.getBoundingClientRect();
    return { el, hitTarget, w: Math.round(r.width), h: Math.round(r.height) };
  });
  const describeTarget = x => ({
    tag: x.el.tagName.toLowerCase(), cls: String(x.el.className || ''),
    name: nameOf(x.el), w: x.w, h: x.h,
    measuredBy: x.hitTarget === x.el ? 'control' : 'label',
  });
  const small = measured.filter(x => x.w < minimumTarget || x.h < minimumTarget).map(describeTarget);
  const compact = targetPolicy ? [] : measured
    .filter(x => (x.w < 44 || x.h < 44) && x.w >= minimumTarget && x.h >= minimumTarget)
    .map(describeTarget);
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
    duplicateIds, unnamed, badImages, jumps, badTables, small, compact, minimumTarget,
  };
})()`;

try {
  // Angemeldet: die Prüfmatrix läuft ALLE Zustände per Hash-Navigation ab,
  // darunter die Fachanwendungen — die liegen seit 2026-08 hinter der
  // Anmeldesperre (js/router.js) und zeigten sonst nur noch deren Band.
  const page = await openPage(cdp, `${APP_BASE}/`, { login: true });
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
      if (r.small.length) {
        totals.targets += r.small.length;
        issues.push(`targets <${r.minimumTarget}px ${r.small.length}`);
      }
      if (r.compact.length) {
        totals.compactTargets += r.compact.length;
        advisories.push({ width, route: item.route, minimumTarget: r.minimumTarget, compact: r.compact });
      }
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
mkdirSync(REVIEW_ASSETS, { recursive: true });
writeFileSync(join(REVIEW_ASSETS, 'audit.json'), JSON.stringify({
  generated: new Date().toISOString(),
  artifactMetadata: {
    status: 'generated-snapshot',
    routeStates: REVIEW_ROUTES.length,
    viewportRenders: totals.routes,
    routeInventorySource: 'scripts/review-routes.mjs',
    note: 'Generated from the current review-routes.mjs inventory.',
  },
  viewports: REVIEW_VIEWPORTS,
  routes: REVIEW_ROUTES.map(x => x.route), totals, findings, advisories,
}, null, 2));
